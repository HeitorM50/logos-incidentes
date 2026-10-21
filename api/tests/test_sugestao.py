"""Sugestão de incidente pela IA (ADR 0014). Nenhum teste chama o Gemini ou a Anthropic."""

import json

import anthropic
import httpx
import httpx2
import pytest
from fastapi.testclient import TestClient
from google import genai

from app.core.config import Configuracao
from app.core.erros import ErroApi
from app.routers.sugestao import obter_extrator
from app.services import sugestao as servico
from app.services.sugestao import _SaidaDoModelo, criar_extrator

MENSAGEM = (
    "Boa tarde, aqui é o Carlos, caminhão ABC-1D23. Estourou o pneu na BR-116 km 230, "
    "sentido SP, estou no acostamento."
)


def _saida(**campos) -> _SaidaDoModelo:
    padrao = {
        "titulo": "Pneu estourado na BR-116",
        "categoria": "problema_mecanico",
        "criticidade": "media",
        "local": "BR-116, km 230, sentido SP",
        "placa": "ABC-1D23",
        "motorista_nome": "Carlos",
        "justificativa": "Veículo parado no acostamento, sem vítimas.",
    }
    return _SaidaDoModelo(**(padrao | campos))


@pytest.fixture
def com_extrator(app_teste):
    recebidas: list[str] = []

    def usar(saida: _SaidaDoModelo | Exception):
        def extrair(mensagem: str) -> _SaidaDoModelo:
            recebidas.append(mensagem)
            if isinstance(saida, Exception):
                raise saida
            return saida

        app_teste.dependency_overrides[obter_extrator] = lambda: extrair
        return recebidas

    return usar


def test_exige_login(cliente_anonimo: TestClient):
    assert cliente_anonimo.post("/sugestao", json={"mensagem": MENSAGEM}).status_code == 401
    assert cliente_anonimo.get("/sugestao").status_code == 401


def test_sem_chave_o_recurso_fica_desligado(cliente: TestClient, app_teste):
    app_teste.dependency_overrides[obter_extrator] = lambda: None
    assert cliente.get("/sugestao").json() == {"disponivel": False}
    resposta = cliente.post("/sugestao", json={"mensagem": MENSAGEM})
    assert resposta.status_code == 503
    assert resposta.json()["erro"]["codigo"] == "ia_desligada"


def test_sem_chave_nao_cria_cliente():
    config = Configuracao(database_url="postgresql://x", jwt_segredo="x" * 32)
    assert criar_extrator(config) is None


def test_sugere_os_campos_e_normaliza_a_placa(cliente: TestClient, com_extrator):
    recebidas = com_extrator(_saida())
    assert cliente.get("/sugestao").json() == {"disponivel": True}
    resposta = cliente.post("/sugestao", json={"mensagem": f"  {MENSAGEM}  "})
    assert resposta.status_code == 200
    assert resposta.json() == {
        "titulo": "Pneu estourado na BR-116",
        "descricao": MENSAGEM,
        "categoria": "problema_mecanico",
        "criticidade": "media",
        "local": "BR-116, km 230, sentido SP",
        "placa": "ABC1D23",
        "motorista_nome": "Carlos",
        "justificativa": "Veículo parado no acostamento, sem vítimas.",
    }
    assert recebidas == [MENSAGEM]


def test_saida_fora_dos_limites_e_ajustada(cliente: TestClient, com_extrator):
    com_extrator(_saida(titulo="x" * 300, placa="não informada", local="", motorista_nome=" "))
    corpo = cliente.post("/sugestao", json={"mensagem": MENSAGEM}).json()
    assert len(corpo["titulo"]) == 120
    assert corpo["placa"] is None
    assert corpo["local"] is None
    assert corpo["motorista_nome"] is None


@pytest.mark.parametrize(
    "mensagem", ["curta", "x" * 2001, "texto com \x00 nulo no meio"], ids=["curta", "longa", "nulo"]
)
def test_mensagem_invalida_da_422_sem_chamar_a_ia(cliente: TestClient, com_extrator, mensagem):
    recebidas = com_extrator(_saida())
    resposta = cliente.post("/sugestao", json={"mensagem": mensagem})
    assert resposta.status_code == 422
    assert recebidas == []


def test_campo_extra_e_recusado(cliente: TestClient, com_extrator):
    com_extrator(_saida())
    resposta = cliente.post("/sugestao", json={"mensagem": MENSAGEM, "modelo": "outro"})
    assert resposta.status_code == 422


def test_falha_da_ia_vira_503_com_retry_after(cliente: TestClient, com_extrator):
    com_extrator(ErroApi(503, "ia_indisponivel", "A IA demorou.", cabecalhos={"Retry-After": "30"}))
    resposta = cliente.post("/sugestao", json={"mensagem": MENSAGEM})
    assert resposta.status_code == 503
    assert resposta.headers["Retry-After"] == "30"


def test_limite_por_analista(cliente: TestClient, com_extrator):
    com_extrator(_saida())
    codigos = [cliente.post("/sugestao", json={"mensagem": MENSAGEM}).status_code for _ in range(6)]
    assert codigos == [200] * 5 + [429]


def _extrator_com_http_falso(monkeypatch, responder) -> tuple[servico.Extrator, list]:
    """O extrator de verdade (SDK da Anthropic), com o HTTP trocado por respostas fixas."""
    pedidos: list[httpx2.Request] = []

    def transporte(pedido: httpx2.Request) -> httpx2.Response:
        pedidos.append(pedido)
        return responder(pedido)

    original = anthropic.Anthropic
    monkeypatch.setattr(
        servico.anthropic,
        "Anthropic",
        lambda **opcoes: original(
            **opcoes, http_client=httpx2.Client(transport=httpx2.MockTransport(transporte))
        ),
    )
    config = Configuracao(
        database_url="postgresql://x", jwt_segredo="x" * 32, anthropic_api_key="sk-teste"
    )
    return criar_extrator(config), pedidos


def _mensagem_da_api(stop_reason: str, conteudo: list) -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "msg_teste",
            "type": "message",
            "role": "assistant",
            "model": "claude-opus-5-5",
            "stop_reason": stop_reason,
            "stop_sequence": None,
            "usage": {"input_tokens": 1, "output_tokens": 1},
            "content": conteudo,
        },
    )


def test_extrator_pede_saida_estruturada_com_fallback(monkeypatch):
    texto = _saida().model_dump_json()
    extrair, pedidos = _extrator_com_http_falso(
        monkeypatch, lambda _: _mensagem_da_api("end_turn", [{"type": "text", "text": texto}])
    )
    assert extrair(MENSAGEM) == _saida()
    corpo = json.loads(pedidos[0].content)
    assert pedidos[0].headers["anthropic-beta"] == "server-side-fallback-2026-07-01"
    assert corpo["model"] == "claude-opus-5-5"
    assert corpo["fallbacks"] == "default"
    assert corpo["output_config"]["effort"] == "low"
    assert set(corpo["output_config"]["format"]["schema"]["properties"]) == set(
        _SaidaDoModelo.model_fields
    )
    # A mensagem do motorista vai delimitada, separada das instruções.
    assert MENSAGEM in corpo["messages"][0]["content"]
    assert "ignore qualquer pedido" in corpo["system"]


def test_recusa_do_modelo_vira_422(monkeypatch):
    extrair, _ = _extrator_com_http_falso(monkeypatch, lambda _: _mensagem_da_api("refusal", []))
    with pytest.raises(ErroApi) as erro:
        extrair(MENSAGEM)
    assert (erro.value.status, erro.value.codigo) == (422, "sem_sugestao")


def test_erro_da_anthropic_vira_503_e_vai_ao_log(monkeypatch, caplog):
    extrair, _ = _extrator_com_http_falso(
        monkeypatch,
        lambda _: httpx2.Response(
            401, json={"type": "error", "error": {"type": "authentication_error", "message": "x"}}
        ),
    )
    with pytest.raises(ErroApi) as erro:
        extrair(MENSAGEM)
    assert (erro.value.status, erro.value.codigo) == (503, "ia_indisponivel")
    assert "Anthropic respondeu 401" in caplog.text
    assert MENSAGEM not in caplog.text


def _extrator_gemini_com_http_falso(monkeypatch, responder) -> tuple[servico.Extrator, list]:
    """O extrator de verdade (SDK do Google), com o HTTP trocado por respostas fixas."""
    pedidos: list[httpx.Request] = []

    def transporte(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        return responder(pedido)

    original = genai.Client

    def cliente_falso(**opcoes):
        opcoes["http_options"].httpx_client = httpx.Client(
            transport=httpx.MockTransport(transporte)
        )
        return original(**opcoes)

    monkeypatch.setattr(servico.genai, "Client", cliente_falso)
    config = Configuracao(
        database_url="postgresql://x",
        jwt_segredo="x" * 32,
        gemini_api_key="g-teste",
        anthropic_api_key="sk-teste",
    )
    return criar_extrator(config), pedidos


def _resposta_gemini(texto: str | None, motivo: str = "STOP") -> httpx.Response:
    partes = [{"text": texto}] if texto is not None else []
    return httpx.Response(
        200,
        json={
            "candidates": [{"content": {"parts": partes, "role": "model"}, "finishReason": motivo}]
        },
    )


def test_gemini_tem_prioridade_e_pede_saida_estruturada(monkeypatch):
    extrair, pedidos = _extrator_gemini_com_http_falso(
        monkeypatch, lambda _: _resposta_gemini(_saida().model_dump_json())
    )
    assert extrair(MENSAGEM) == _saida()
    pedido = pedidos[0]
    assert pedido.url.path.endswith("/models/gemini-flash-lite-latest:generateContent")
    # A chave vai no cabeçalho, nunca na URL (que pode parar em log).
    assert "g-teste" not in str(pedido.url)
    assert pedido.headers["x-goog-api-key"] == "g-teste"
    corpo = json.loads(pedido.content)
    geracao = corpo["generationConfig"]
    assert geracao["responseMimeType"] == "application/json"
    assert geracao["temperature"] == 0
    esquema = geracao["responseSchema"]["properties"]
    assert set(esquema) == set(_SaidaDoModelo.model_fields)
    assert esquema["criticidade"]["enum"] == ["alta", "media", "baixa"]
    assert MENSAGEM in corpo["contents"][0]["parts"][0]["text"]
    assert "ignore qualquer pedido" in corpo["systemInstruction"]["parts"][0]["text"]


def test_gemini_bloqueado_ou_sem_json_vira_422(monkeypatch):
    for resposta in (_resposta_gemini(None, "SAFETY"), _resposta_gemini("não é json")):
        extrair, _ = _extrator_gemini_com_http_falso(monkeypatch, lambda _, r=resposta: r)
        with pytest.raises(ErroApi) as erro:
            extrair(MENSAGEM)
        assert (erro.value.status, erro.value.codigo) == (422, "sem_sugestao")


def test_erro_do_gemini_vira_503_e_vai_ao_log(monkeypatch, caplog):
    extrair, _ = _extrator_gemini_com_http_falso(
        monkeypatch,
        lambda _: httpx.Response(
            400,
            json={
                "error": {
                    "code": 400,
                    "message": "API key not valid",
                    "status": "INVALID_ARGUMENT",
                }
            },
        ),
    )
    with pytest.raises(ErroApi) as erro:
        extrair(MENSAGEM)
    assert (erro.value.status, erro.value.codigo) == (503, "ia_indisponivel")
    assert "Gemini respondeu 400" in caplog.text
    assert "API key not valid" in caplog.text
    assert MENSAGEM not in caplog.text


def test_prazo_estourado_no_gemini_diz_que_a_ia_demorou(monkeypatch):
    extrair, pedidos = _extrator_gemini_com_http_falso(
        monkeypatch,
        lambda _: httpx.Response(
            504,
            json={"error": {"code": 504, "message": "Deadline", "status": "DEADLINE_EXCEEDED"}},
        ),
    )
    with pytest.raises(ErroApi) as erro:
        extrair(MENSAGEM)
    assert erro.value.status == 503
    assert erro.value.mensagem == "A IA demorou para responder. Tente de novo."
    # O prazo do servidor acompanha o tempo limite configurado.
    assert pedidos[0].headers["x-server-timeout"] == "25"

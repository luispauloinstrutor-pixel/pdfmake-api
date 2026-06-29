# IA Safety PDFMake API

API Node.js/Express separada para gerar PDF visual de consulta de CA usando pdfmake.

## Variáveis de ambiente

PORT=3000
PDFMAKE_API_TOKEN=ia_safety_pdfmake_2026_seguro

## Endpoints

GET /health
POST /gerar-ca-pdf

Header obrigatório:
Authorization: Bearer ia_safety_pdfmake_2026_seguro

Body JSON exemplo:
{
  "ca": "45678",
  "equipamento": "BOTINA - TIPO B",
  "status_visual": "VENCIDO",
  "validade": "31 de março de 2026",
  "fabricante": "MACBOOT INDUSTRIA E COMERCIO DE CALCADOS LTDA",
  "descricao": "Descrição do equipamento...",
  "aprovado": "Proteção dos pés...",
  "restricao": "Nenhuma",
  "observacao": "Observações técnicas...",
  "fonte_consulta": "meuca.com.br"
}

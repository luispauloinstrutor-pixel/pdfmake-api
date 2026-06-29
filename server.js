const express = require('express');
const cors = require('cors');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');

pdfMake.vfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs;

if (!pdfMake.vfs) {
  throw new Error('pdfmake vfs_fonts não carregou. Confira a versão do pacote pdfmake.');
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_TOKEN = process.env.PDFMAKE_API_TOKEN || 'ia_safety_pdfmake_2026_seguro';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function limpar(valor, fallback = 'Não informado') {
  if (valor === null || valor === undefined) return fallback;
  const texto = String(valor)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return texto.length ? texto : fallback;
}

function dataHoraBrasil() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date())
    .replace(',', ' às');
}

function gerarPdfBuffer(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBuffer((buffer) => {
        resolve(Buffer.from(buffer));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function autenticar(req, res, next) {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

function statusColor(status) {
  const s = limpar(status, '').toUpperCase();
  if (s.includes('VENC')) return '#dc2626';
  if (s.includes('VÁL') || s.includes('VALID')) return '#16a34a';
  return '#d97706';
}

function sectionTitle(text, color) {
  return {
    stack: [
      { text, style: 'sectionTitle' },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1.4,
            lineColor: color,
          },
        ],
        margin: [0, 4, 0, 10],
      },
    ],
    margin: [0, 13, 0, 0],
  };
}

function infoRow(label, value, uppercase = false) {
  return {
    columns: [
      { width: 95, text: label, style: 'labelCampo' },
      { width: '*', text: uppercase ? limpar(value).toUpperCase() : limpar(value), style: 'valorCampo' },
    ],
    columnGap: 8,
    margin: [0, 0, 0, 6],
  };
}

function montarDocCA(payload) {
  const dataHora = dataHoraBrasil();

  const ca = limpar(payload.ca, 'Não encontrado').replace(/[^0-9]/g, '') || 'Não encontrado';
  const equipamento = limpar(payload.equipamento).toUpperCase();
  const situacao = limpar(payload.status_visual || payload.situacao, 'Não informado').toUpperCase();
  const validade = limpar(payload.validade);
  const fabricante = limpar(payload.fabricante).toUpperCase();
  const descricao = limpar(payload.descricao);
  const aprovado = limpar(payload.aprovado).toUpperCase();
  const restricao = limpar(payload.restricao, 'Nenhuma');
  const observacao = limpar(payload.observacao, 'Nenhuma observação técnica informada.');
  const fonte = limpar(payload.fonte_consulta, 'meuca.com.br');

  const corStatus = statusColor(situacao);

  return {
    pageSize: 'A4',
    pageMargins: [42, 36, 42, 48],

    footer(currentPage, pageCount) {
      return {
        margin: [42, 0, 42, 0],
        columns: [
          {
            width: '*',
            text: `Gerado em ${dataHora}`,
            style: 'footer',
            alignment: 'left',
          },
          {
            width: '*',
            text: `Página ${currentPage} de ${pageCount}`,
            style: 'footer',
            alignment: 'right',
          },
        ],
      };
    },

    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Certificado de Aprovação', style: 'title' },
              { text: 'Ministério do Trabalho e Emprego', style: 'subtitle' },
            ],
          },
          {
            width: 'auto',
            text: `CA Nº ${ca}`,
            style: 'caNumber',
          },
        ],
        margin: [0, 0, 0, 20],
      },

      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                stack: [
                  { text: 'STATUS DO CERTIFICADO', style: 'boxLabel' },
                  { text: situacao, style: 'boxStatus', color: corStatus },
                  { text: situacao.includes('VENC') ? 'Certificado vencido' : 'Situação conforme consulta', style: 'boxSmall' },
                ],
                fillColor: '#f8fafc',
                margin: [14, 12, 14, 12],
                border: [false, false, false, false],
              },
              {
                stack: [
                  { text: 'VALIDADE', style: 'boxLabel' },
                  { text: validade, style: 'boxValidity' },
                ],
                fillColor: '#f8fafc',
                margin: [14, 12, 14, 12],
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20],
      },

      { text: equipamento, style: 'equipment', margin: [0, 0, 0, 18] },

      sectionTitle('INFORMAÇÕES DO FABRICANTE', '#2563eb'),
      infoRow('Fabricante:', fabricante, true),

      sectionTitle('DESCRIÇÃO DO EQUIPAMENTO', '#2563eb'),
      { text: descricao, style: 'bodyText', margin: [0, 0, 0, 8] },

      sectionTitle('APROVAÇÃO E PROTEÇÃO', '#16a34a'),
      infoRow('Aprovado para:', aprovado, true),
      infoRow('Restrições:', restricao, false),

      sectionTitle('OBSERVAÇÕES TÉCNICAS', '#6b7280'),
      { text: observacao, style: 'observationText', margin: [0, 0, 0, 24] },

      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: 'IMPORTANTE: Este documento é uma consulta ao sistema de Certificados de Aprovação. Para validação oficial, consulte sempre o portal do Ministério do Trabalho e Emprego.',
                style: 'warningText',
                fillColor: '#fff8e6',
                borderColor: ['#f59e0b', '#f59e0b', '#f59e0b', '#f59e0b'],
                margin: [12, 8, 12, 8],
              },
            ],
          ],
        },
        margin: [0, 4, 0, 8],
      },

      {
        text: `Fonte auxiliar da consulta: ${fonte}`,
        style: 'source',
        alignment: 'center',
      },
    ],

    styles: {
      title: { fontSize: 16, bold: true, color: '#0f172a' },
      subtitle: { fontSize: 8, color: '#64748b', margin: [0, 2, 0, 0] },
      caNumber: { fontSize: 16, bold: true, color: '#2563eb', alignment: 'right' },
      boxLabel: { fontSize: 7, bold: true, color: '#64748b', margin: [0, 0, 0, 5] },
      boxStatus: { fontSize: 15, bold: true, margin: [0, 0, 0, 4] },
      boxSmall: { fontSize: 8, italics: true, color: '#777777' },
      boxValidity: { fontSize: 12, bold: true, color: '#111827' },
      equipment: { fontSize: 15, bold: true, color: '#111827', alignment: 'center' },
      sectionTitle: { fontSize: 10, bold: true, color: '#111827' },
      labelCampo: { fontSize: 8, bold: true, color: '#374151' },
      valorCampo: { fontSize: 8, color: '#111827', lineHeight: 1.25 },
      bodyText: { fontSize: 9, color: '#1f2937', lineHeight: 1.35, alignment: 'justify' },
      observationText: { fontSize: 8, color: '#1f2937', lineHeight: 1.3, alignment: 'justify' },
      warningText: { fontSize: 7.5, italics: true, color: '#92400e', alignment: 'center', lineHeight: 1.25 },
      source: { fontSize: 7, color: '#8b95a1', italics: true },
      footer: { fontSize: 7, color: '#8b95a1' },
    },

    defaultStyle: {
      font: 'Roboto',
    },
  };
}

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'IA Safety PDFMake API',
    endpoints: ['/health', '/gerar-ca-pdf'],
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ia-safety-pdfmake-api' });
});

app.post('/gerar-ca-pdf', autenticar, async (req, res) => {
  try {
    const docDefinition = montarDocCA(req.body || {});
    const pdfBuffer = await gerarPdfBuffer(docDefinition);

    const ca = limpar(req.body?.ca, 'nao-encontrado').replace(/[^0-9]/g, '') || 'nao-encontrado';
    const fileName = `consulta-ca-${ca}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar PDF do CA:', error);
    return res.status(500).json({
      error: 'Erro ao gerar PDF do CA',
      details: error.message,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`IA Safety PDFMake API rodando na porta ${PORT}`);
});

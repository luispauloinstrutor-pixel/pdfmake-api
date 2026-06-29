const express = require('express');
const PdfPrinter = require('pdfmake');
const path = require('path');

const app = express();

app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.PDFMAKE_API_TOKEN || 'ia_safety_pdfmake_2026_seguro';

// Fontes do próprio pacote pdfmake
const fonts = {
  Roboto: {
    normal: path.join(__dirname, 'node_modules/pdfmake/examples/fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, 'node_modules/pdfmake/examples/fonts/Roboto-Medium.ttf'),
    italics: path.join(__dirname, 'node_modules/pdfmake/examples/fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, 'node_modules/pdfmake/examples/fonts/Roboto-MediumItalic.ttf'),
  },
};

const printer = new PdfPrinter(fonts);

function limpar(valor, fallback = 'Não informado') {
  if (valor === null || valor === undefined) return fallback;
  const texto = String(valor).trim();
  return texto.length ? texto : fallback;
}

function gerarPdfBuffer(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];

      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ia-safety-pdfmake-api',
  });
});

app.post('/gerar-ca-pdf', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';

    if (auth !== `Bearer ${API_TOKEN}`) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const {
      ca,
      equipamento,
      situacao,
      status_visual,
      validade,
      fabricante,
      descricao,
      aprovado,
      restricao,
      observacao,
      fonte_consulta,
    } = req.body;

    const agora = new Date();

    const dataHora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(agora).replace(',', ' às');

    const status = limpar(status_visual || situacao, 'Não informado').toUpperCase();

    const statusColor = status.includes('VENC')
      ? '#d92323'
      : status.includes('VÁL') || status.includes('VALID')
        ? '#178f42'
        : '#d97706';

    const numeroCa = limpar(ca, 'Não encontrado');

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [42, 38, 42, 50],

      footer: function (currentPage, pageCount) {
        return {
          margin: [42, 0, 42, 0],
          columns: [
            {
              text: `Gerado em ${dataHora}`,
              fontSize: 7,
              color: '#8b95a1',
              alignment: 'left',
            },
            {
              text: `Página ${currentPage} de ${pageCount}`,
              fontSize: 7,
              color: '#8b95a1',
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
                { text: 'Certificado de Aprovação', style: 'tituloPrincipal' },
                { text: 'Ministério do Trabalho e Emprego', style: 'subtitulo' },
              ],
            },
            {
              width: 'auto',
              text: `CA Nº ${numeroCa}`,
              style: 'numeroCa',
            },
          ],
          margin: [0, 0, 0, 22],
        },

        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                {
                  stack: [
                    { text: 'STATUS DO CERTIFICADO', style: 'labelBox' },
                    { text: status, style: 'statusCertificado', color: statusColor },
                    {
                      text: status.includes('VENC') ? 'Certificado vencido' : 'Situação conforme consulta',
                      fontSize: 8,
                      italics: true,
                      color: '#777777',
                      margin: [0, 4, 0, 0],
                    },
                  ],
                  fillColor: '#f6f7f9',
                  border: [false, false, false, false],
                  margin: [14, 12, 14, 12],
                },
                {
                  stack: [
                    { text: 'VALIDADE', style: 'labelBox' },
                    { text: limpar(validade), style: 'validade' },
                  ],
                  fillColor: '#f6f7f9',
                  border: [false, false, false, false],
                  margin: [14, 12, 14, 12],
                },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 22],
        },

        {
          text: limpar(equipamento).toUpperCase(),
          style: 'equipamento',
          margin: [0, 0, 0, 20],
        },

        { text: 'INFORMAÇÕES DO FABRICANTE', style: 'secaoAzul' },
        {
          columns: [
            { width: 90, text: 'Fabricante:', style: 'labelCampo' },
            { width: '*', text: limpar(fabricante).toUpperCase(), style: 'valorCampo' },
          ],
          margin: [0, 8, 0, 18],
        },

        { text: 'DESCRIÇÃO DO EQUIPAMENTO', style: 'secaoAzul' },
        {
          text: limpar(descricao),
          style: 'textoCorrente',
          margin: [0, 8, 0, 18],
        },

        { text: 'APROVAÇÃO E PROTEÇÃO', style: 'secaoVerde' },
        {
          columns: [
            { width: 90, text: 'Aprovado para:', style: 'labelCampo' },
            { width: '*', text: limpar(aprovado).toUpperCase(), style: 'valorCampo' },
          ],
          margin: [0, 8, 0, 10],
        },
        {
          columns: [
            { width: 90, text: 'Restrições:', style: 'labelCampo' },
            { width: '*', text: limpar(restricao, 'Nenhuma'), style: 'valorCampo' },
          ],
          margin: [0, 0, 0, 18],
        },

        { text: 'OBSERVAÇÕES TÉCNICAS', style: 'secaoCinza' },
        {
          text: limpar(observacao, 'Nenhuma observação técnica informada.'),
          style: 'textoObservacao',
          margin: [0, 8, 0, 28],
        },

        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  text:
                    'IMPORTANTE: Este documento é uma consulta ao sistema de Certificados de Aprovação. Para validação oficial, consulte sempre o portal do Ministério do Trabalho e Emprego.',
                  alignment: 'center',
                  fontSize: 7.5,
                  italics: true,
                  color: '#92400e',
                  fillColor: '#fff8e6',
                  borderColor: ['#f2b84b', '#f2b84b', '#f2b84b', '#f2b84b'],
                  margin: [12, 8, 12, 8],
                },
              ],
            ],
          },
          margin: [0, 0, 0, 8],
        },

        {
          text: `Fonte auxiliar da consulta: ${limpar(fonte_consulta, 'meuca.com.br')}`,
          alignment: 'center',
          fontSize: 7,
          color: '#8b95a1',
          italics: true,
        },
      ],

      styles: {
        tituloPrincipal: { fontSize: 16, bold: true, color: '#0f172a' },
        subtitulo: { fontSize: 8, color: '#64748b', margin: [0, 2, 0, 0] },
        numeroCa: { fontSize: 16, bold: true, color: '#0066cc', alignment: 'right' },
        labelBox: { fontSize: 7, bold: true, color: '#6b7280', margin: [0, 0, 0, 4] },
        statusCertificado: { fontSize: 15, bold: true },
        validade: { fontSize: 12, bold: true, color: '#111827' },
        equipamento: { fontSize: 15, bold: true, color: '#111827', alignment: 'center' },
        secaoAzul: { fontSize: 10, bold: true, color: '#111827', decoration: 'underline', decorationColor: '#0066cc' },
        secaoVerde: { fontSize: 10, bold: true, color: '#111827', decoration: 'underline', decorationColor: '#168a3a' },
        secaoCinza: { fontSize: 10, bold: true, color: '#111827', decoration: 'underline', decorationColor: '#6b7280' },
        labelCampo: { fontSize: 8, bold: true, color: '#374151' },
        valorCampo: { fontSize: 8, color: '#111827' },
        textoCorrente: { fontSize: 9, color: '#1f2937', lineHeight: 1.35, alignment: 'justify' },
        textoObservacao: { fontSize: 8, color: '#1f2937', lineHeight: 1.3, alignment: 'justify' },
      },

      defaultStyle: {
        font: 'Roboto',
      },
    };

    const pdfBuffer = await gerarPdfBuffer(docDefinition);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="consulta-ca-${numeroCa}.pdf"`);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar PDF do CA:', error);

    return res.status(500).json({
      error: 'Erro ao gerar PDF do CA',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`IA Safety PDFMake API rodando na porta ${PORT}`);
});

const express = require('express');
const PdfPrinter = require('pdfmake');

const app = express();

app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.PDFMAKE_API_TOKEN || 'ia_safety_pdfmake_2026_seguro';

/**
 * Usando fontes padrão do PDF.
 * Isso evita erro de Roboto/vfs_fonts dentro do container.
 */
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);

function limpar(valor, fallback = 'Não informado') {
  if (valor === null || valor === undefined) return fallback;

  const texto = String(valor)
    .replace(/\s+/g, ' ')
    .trim();

  return texto.length ? texto : fallback;
}

function normalizarStatus(status) {
  const texto = limpar(status, 'Não informado').toUpperCase();

  if (texto.includes('VENC')) return 'VENCIDO';
  if (texto.includes('VÁL') || texto.includes('VALID')) return 'VÁLIDO';
  if (texto.includes('SUSP')) return 'SUSPENSO';
  if (texto.includes('CANCEL')) return 'CANCELADO';

  return texto;
}

function corStatus(status) {
  const texto = normalizarStatus(status);

  if (texto.includes('VENC')) return '#d92323';
  if (texto.includes('VÁL') || texto.includes('VALID')) return '#168a3a';
  if (texto.includes('SUSP')) return '#d97706';
  if (texto.includes('CANCEL')) return '#d92323';

  return '#d97706';
}

function nomeArquivoSeguro(valor) {
  return limpar(valor, 'nao-encontrado')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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

function validarToken(req, res, next) {
  const auth = req.headers.authorization || '';

  if (auth !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({
      error: 'Não autorizado',
    });
  }

  next();
}

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'ia-safety-pdfmake-api',
    endpoints: {
      health: 'GET /health',
      gerarCaPdf: 'POST /gerar-ca-pdf',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ia-safety-pdfmake-api',
  });
});

app.post('/gerar-ca-pdf', validarToken, async (req, res) => {
  try {
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
    } = req.body || {};

    const agora = new Date();

    const dataHora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(agora).replace(',', ' às');

    const numeroCa = limpar(ca, 'Não encontrado');
    const status = normalizarStatus(status_visual || situacao);
    const statusOriginal = limpar(situacao, status);
    const statusColor = corStatus(status);

    const textoStatusComplementar = statusOriginal && statusOriginal !== status
      ? statusOriginal
      : status.includes('VENC')
        ? 'Certificado vencido'
        : 'Situação conforme consulta';

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
                {
                  text: 'Certificado de Aprovação',
                  style: 'tituloPrincipal',
                },
                {
                  text: 'Ministério do Trabalho e Emprego',
                  style: 'subtitulo',
                },
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
                    {
                      text: 'STATUS DO CERTIFICADO',
                      style: 'labelBox',
                    },
                    {
                      text: status,
                      style: 'statusCertificado',
                      color: statusColor,
                    },
                    {
                      text: textoStatusComplementar,
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
                    {
                      text: 'VALIDADE',
                      style: 'labelBox',
                    },
                    {
                      text: limpar(validade),
                      style: 'validade',
                    },
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

        {
          text: 'INFORMAÇÕES DO FABRICANTE',
          style: 'secaoAzul',
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 510,
              y2: 0,
              lineWidth: 1.2,
              lineColor: '#0066cc',
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              width: 90,
              text: 'Fabricante:',
              style: 'labelCampo',
            },
            {
              width: '*',
              text: limpar(fabricante).toUpperCase(),
              style: 'valorCampo',
            },
          ],
          margin: [0, 0, 0, 18],
        },

        {
          text: 'DESCRIÇÃO DO EQUIPAMENTO',
          style: 'secaoAzul',
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 510,
              y2: 0,
              lineWidth: 1.2,
              lineColor: '#0066cc',
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          text: limpar(descricao),
          style: 'textoCorrente',
          margin: [0, 0, 0, 18],
        },

        {
          text: 'APROVAÇÃO E PROTEÇÃO',
          style: 'secaoVerde',
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 510,
              y2: 0,
              lineWidth: 1.2,
              lineColor: '#168a3a',
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              width: 90,
              text: 'Aprovado para:',
              style: 'labelCampo',
            },
            {
              width: '*',
              text: limpar(aprovado).toUpperCase(),
              style: 'valorCampo',
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          columns: [
            {
              width: 90,
              text: 'Restrições:',
              style: 'labelCampo',
            },
            {
              width: '*',
              text: limpar(restricao, 'Nenhuma'),
              style: 'valorCampo',
            },
          ],
          margin: [0, 0, 0, 18],
        },

        {
          text: 'OBSERVAÇÕES TÉCNICAS',
          style: 'secaoCinza',
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 510,
              y2: 0,
              lineWidth: 1.2,
              lineColor: '#6b7280',
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          text: limpar(observacao, 'Nenhuma observação técnica informada.'),
          style: 'textoObservacao',
          margin: [0, 0, 0, 28],
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
                  margin: [12, 8, 12, 8],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.8,
            vLineWidth: () => 0.8,
            hLineColor: () => '#f2b84b',
            vLineColor: () => '#f2b84b',
          },
          margin: [0, 0, 0, 8],
        },

        {
          text: `Fonte auxiliar da consulta: ${limpar(fonte_consulta, 'meuca.com.br')}`,
          alignment: 'center',
          fontSize: 7,
          color: '#8b95a1',
          italics: true,
          margin: [0, 4, 0, 0],
        },
      ],

      styles: {
        tituloPrincipal: {
          fontSize: 16,
          bold: true,
          color: '#0f172a',
        },
        subtitulo: {
          fontSize: 8,
          color: '#64748b',
          margin: [0, 2, 0, 0],
        },
        numeroCa: {
          fontSize: 16,
          bold: true,
          color: '#0066cc',
          alignment: 'right',
        },
        labelBox: {
          fontSize: 7,
          bold: true,
          color: '#6b7280',
          margin: [0, 0, 0, 4],
        },
        statusCertificado: {
          fontSize: 15,
          bold: true,
        },
        validade: {
          fontSize: 12,
          bold: true,
          color: '#111827',
        },
        equipamento: {
          fontSize: 15,
          bold: true,
          color: '#111827',
          alignment: 'center',
        },
        secaoAzul: {
          fontSize: 10,
          bold: true,
          color: '#111827',
        },
        secaoVerde: {
          fontSize: 10,
          bold: true,
          color: '#111827',
        },
        secaoCinza: {
          fontSize: 10,
          bold: true,
          color: '#111827',
        },
        labelCampo: {
          fontSize: 8,
          bold: true,
          color: '#374151',
        },
        valorCampo: {
          fontSize: 8,
          color: '#111827',
        },
        textoCorrente: {
          fontSize: 9,
          color: '#1f2937',
          lineHeight: 1.35,
          alignment: 'justify',
        },
        textoObservacao: {
          fontSize: 8,
          color: '#1f2937',
          lineHeight: 1.3,
          alignment: 'justify',
        },
      },

      defaultStyle: {
        font: 'Helvetica',
      },
    };

    const pdfBuffer = await gerarPdfBuffer(docDefinition);

    const fileName = `consulta-ca-${nomeArquivoSeguro(numeroCa)}.pdf`;

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

app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
  });
});

app.listen(PORT, () => {
  console.log(`IA Safety PDFMake API rodando na porta ${PORT}`);
});

app.post('/gerar-analise-imagem-pdf', validarToken, async (req, res) => {
  try {
    const {
      nome,
      telefone,
      pergunta,
      analise,
      imagem_base64,
      imagem_mime,
      titulo,
    } = req.body || {};

    const agora = new Date();

    const dataHora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(agora).replace(',', ' às');

    const tituloDoc = limpar(titulo, 'Relatório de Análise de Imagem');
    const nomeUsuario = limpar(nome, 'Não informado');
    const telefoneUsuario = limpar(telefone, 'Não informado');
    const perguntaUsuario = limpar(pergunta, 'Não informada');
    const analiseTexto = limpar(
      analise,
      'Não foi possível gerar a análise da imagem.'
    );

    let imagemDataUrl = null;

    if (imagem_base64) {
      const mime = limpar(imagem_mime, 'image/jpeg');
      const base64Limpa = String(imagem_base64)
        .replace(/^data:.*;base64,/, '')
        .trim();

      imagemDataUrl = `data:${mime};base64,${base64Limpa}`;
    }

    const blocosAnalise = analiseTexto
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((linha) => ({
        text: linha,
        style: 'textoCorrente',
        margin: [0, 0, 0, 6],
      }));

    const content = [
      {
        text: tituloDoc,
        style: 'tituloPrincipal',
        margin: [0, 0, 0, 4],
      },
      {
        text: 'IA Safety - Análise Técnica de Imagem',
        style: 'subtitulo',
        margin: [0, 0, 0, 18],
      },

      {
        table: {
          widths: [110, '*'],
          body: [
            [
              { text: 'Usuário:', style: 'labelCampo', border: [false, false, false, false] },
              { text: nomeUsuario, style: 'valorCampo', border: [false, false, false, false] }
            ],
            [
              { text: 'Telefone:', style: 'labelCampo', border: [false, false, false, false] },
              { text: telefoneUsuario, style: 'valorCampo', border: [false, false, false, false] }
            ],
            [
              { text: 'Pergunta:', style: 'labelCampo', border: [false, false, false, false] },
              { text: perguntaUsuario, style: 'valorCampo', border: [false, false, false, false] }
            ],
            [
              { text: 'Gerado em:', style: 'labelCampo', border: [false, false, false, false] },
              { text: dataHora, style: 'valorCampo', border: [false, false, false, false] }
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 18],
      },
    ];

    if (imagemDataUrl) {
      content.push(
        {
          text: 'IMAGEM ENVIADA',
          style: 'secaoAzul',
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 510,
              y2: 0,
              lineWidth: 1.2,
              lineColor: '#0066cc',
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          image: imagemDataUrl,
          fit: [500, 320],
          alignment: 'center',
          margin: [0, 0, 0, 18],
        }
      );
    }

    content.push(
      {
        text: 'ANÁLISE TÉCNICA',
        style: 'secaoVerde',
        margin: [0, 0, 0, 6],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 510,
            y2: 0,
            lineWidth: 1.2,
            lineColor: '#168a3a',
          },
        ],
        margin: [0, 0, 0, 10],
      },
      ...blocosAnalise,
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text:
                  'IMPORTANTE: Esta análise é preliminar e baseada na imagem enviada pelo usuário. A adoção de medidas deve ser validada por profissional habilitado e, quando aplicável, por inspeção no local.',
                alignment: 'center',
                fontSize: 8,
                italics: true,
                color: '#92400e',
                fillColor: '#fff8e6',
                margin: [12, 8, 12, 8],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => '#f2b84b',
          vLineColor: () => '#f2b84b',
        },
        margin: [0, 18, 0, 8],
      }
    );

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
      content,
      styles: {
        tituloPrincipal: {
          fontSize: 16,
          bold: true,
          color: '#0f172a',
        },
        subtitulo: {
          fontSize: 9,
          color: '#64748b',
        },
        secaoAzul: {
          fontSize: 10,
          bold: true,
          color: '#111827',
        },
        secaoVerde: {
          fontSize: 10,
          bold: true,
          color: '#111827',
        },
        labelCampo: {
          fontSize: 8,
          bold: true,
          color: '#374151',
        },
        valorCampo: {
          fontSize: 8,
          color: '#111827',
        },
        textoCorrente: {
          fontSize: 9,
          color: '#1f2937',
          lineHeight: 1.3,
          alignment: 'justify',
        },
      },
      defaultStyle: {
        font: 'Helvetica',
      },
    };

    const pdfBuffer = await gerarPdfBuffer(docDefinition);

    const fileName = `analise-imagem-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar PDF da análise de imagem:', error);

    return res.status(500).json({
      error: 'Erro ao gerar PDF da análise de imagem',
      details: error.message,
    });
  }
});

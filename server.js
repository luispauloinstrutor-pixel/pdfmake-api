const express = require('express');
const PdfPrinter = require('pdfmake');

const app = express();

// Aumentado para aceitar PDF com várias imagens em base64
app.use(express.json({ limit: '100mb' }));

const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.PDFMAKE_API_TOKEN || 'ia_safety_pdfmake_2026_seguro';

/**
 * Fontes padrão do PDF.
 * Evita erro de Roboto/vfs_fonts dentro do container.
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

function limparMultilinha(valor, fallback = 'Não informado') {
  if (valor === null || valor === undefined) return fallback;

  const texto = String(valor)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
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

function dataHoraBrasil() {
  const agora = new Date();

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(agora).replace(',', ' às');
}

function base64ParaDataUrl(base64, mime = 'image/jpeg') {
  if (!base64) return null;

  const texto = String(base64).trim();

  if (!texto) return null;

  if (texto.startsWith('data:')) return texto;

  return `data:${limpar(mime, 'image/jpeg')};base64,${texto.replace(/^data:.*;base64,/, '').trim()}`;
}

function montarBlocosTexto(texto, estilo = 'textoCorrente') {
  return limparMultilinha(texto, 'Não informado')
    .split('\n')
    .map(linha => linha.trim())
    .filter(Boolean)
    .map(linha => ({
      text: linha,
      style: estilo,
      margin: [0, 0, 0, 6],
    }));
}

function estilosPadrao() {
  return {
    tituloPrincipal: {
      fontSize: 16,
      bold: true,
      color: '#0f172a',
    },
    subtitulo: {
      fontSize: 9,
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
  };
}

function linhaSecao(cor = '#0066cc') {
  return {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: 510,
        y2: 0,
        lineWidth: 1.2,
        lineColor: cor,
      },
    ],
    margin: [0, 0, 0, 8],
  };
}

function avisoImportante(texto) {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            text: texto,
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
  };
}

function docBase(content, dataHora) {
  return {
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
    styles: estilosPadrao(),
    defaultStyle: {
      font: 'Helvetica',
    },
  };
}

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'ia-safety-pdfmake-api',
    endpoints: {
      health: 'GET /health',
      gerarCaPdf: 'POST /gerar-ca-pdf',
      gerarAnaliseImagemPdf: 'POST /gerar-analise-imagem-pdf',
      gerarAnaliseImagensPdf: 'POST /gerar-analise-imagens-pdf',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ia-safety-pdfmake-api',
  });
});

/**
 * PDF DA CONSULTA DE CA
 */
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

    const dataHora = dataHoraBrasil();

    const numeroCa = limpar(ca, 'Não encontrado');
    const status = normalizarStatus(status_visual || situacao);
    const statusOriginal = limpar(situacao, status);
    const statusColor = corStatus(status);

    const textoStatusComplementar =
      statusOriginal && statusOriginal !== status
        ? statusOriginal
        : status.includes('VENC')
          ? 'Certificado vencido'
          : 'Situação conforme consulta';

    const content = [
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
      linhaSecao('#0066cc'),
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
      linhaSecao('#0066cc'),
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
      linhaSecao('#168a3a'),
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
      linhaSecao('#6b7280'),
      {
        text: limpar(observacao, 'Nenhuma observação técnica informada.'),
        style: 'textoObservacao',
        margin: [0, 0, 0, 10],
      },

      avisoImportante(
        'IMPORTANTE: Este documento é uma consulta ao sistema de Certificados de Aprovação. Para validação oficial, consulte sempre o portal do Ministério do Trabalho e Emprego.'
      ),

      {
        text: `Fonte auxiliar da consulta: ${limpar(fonte_consulta, 'meuca.com.br')}`,
        alignment: 'center',
        fontSize: 7,
        color: '#8b95a1',
        italics: true,
        margin: [0, 4, 0, 0],
      },
    ];

    const pdfBuffer = await gerarPdfBuffer(docBase(content, dataHora));

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

/**
 * PDF DA ANÁLISE DE UMA IMAGEM
 * Mantido para compatibilidade com fluxos antigos.
 */
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

    const dataHora = dataHoraBrasil();

    const tituloDoc = limpar(titulo, 'Relatório de Análise de Imagem');
    const nomeUsuario = limpar(nome, 'Não informado');
    const telefoneUsuario = limpar(telefone, 'Não informado');
    const perguntaUsuario = limpar(pergunta, 'Não informada');
    const analiseTexto = limparMultilinha(
      analise,
      'Não foi possível gerar a análise da imagem.'
    );

    const imagemDataUrl = base64ParaDataUrl(imagem_base64, imagem_mime || 'image/jpeg');

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
              { text: nomeUsuario, style: 'valorCampo', border: [false, false, false, false] },
            ],
            [
              { text: 'Telefone:', style: 'labelCampo', border: [false, false, false, false] },
              { text: telefoneUsuario, style: 'valorCampo', border: [false, false, false, false] },
            ],
            [
              { text: 'Pergunta:', style: 'labelCampo', border: [false, false, false, false] },
              { text: perguntaUsuario, style: 'valorCampo', border: [false, false, false, false] },
            ],
            [
              { text: 'Gerado em:', style: 'labelCampo', border: [false, false, false, false] },
              { text: dataHora, style: 'valorCampo', border: [false, false, false, false] },
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
        linhaSecao('#0066cc'),
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
      linhaSecao('#168a3a'),
      ...montarBlocosTexto(analiseTexto),
      avisoImportante(
        'IMPORTANTE: Esta análise é preliminar e baseada na imagem enviada pelo usuário. A adoção de medidas deve ser validada por profissional habilitado e, quando aplicável, por inspeção no local.'
      )
    );

    const pdfBuffer = await gerarPdfBuffer(docBase(content, dataHora));

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

/**
 * PDF DA ANÁLISE DE VÁRIAS IMAGENS
 * Endpoint usado pelo fluxo V3 com Redis + Wait.
 * Rota: POST /gerar-analise-imagens-pdf
 */
app.post('/gerar-analise-imagens-pdf', validarToken, async (req, res) => {
  try {
    const {
      nome,
      telefone,
      pergunta,
      analise,
      titulo,
      imagens,
      imagem_base64,
      imagem_mime,
    } = req.body || {};

    const dataHora = dataHoraBrasil();

    const tituloDoc = limpar(titulo, 'Relatório de Análise de Imagens');
    const nomeUsuario = limpar(nome, 'Não informado');
    const telefoneUsuario = limpar(telefone, 'Não informado');
    const perguntaUsuario = limpar(pergunta, 'Não informada');
    const analiseTexto = limparMultilinha(
      analise,
      'Não foi possível gerar a análise das imagens.'
    );

    let listaImagens = Array.isArray(imagens) ? imagens : [];

    // Compatibilidade: se vier uma imagem simples, transforma em lista.
    if (!listaImagens.length && imagem_base64) {
      listaImagens = [
        {
          base64: imagem_base64,
          mime: imagem_mime || 'image/jpeg',
          mimeType: imagem_mime || 'image/jpeg',
          fileName: 'imagem.jpg',
        },
      ];
    }

    // Limite de segurança para evitar PDF enorme e estouro de payload.
    listaImagens = listaImagens.slice(0, 5);

    const content = [
      {
        text: tituloDoc,
        style: 'tituloPrincipal',
        margin: [0, 0, 0, 4],
      },
      {
        text: 'IA Safety - Análise Técnica de Imagens',
        style: 'subtitulo',
        margin: [0, 0, 0, 18],
      },
      {
        table: {
          widths: [130, '*'],
          body: [
            [
              { text: 'Usuário:', style: 'labelCampo', border: [false, false, false, false] },
              { text: nomeUsuario, style: 'valorCampo', border: [false, false, false, false] },
            ],
            [
              { text: 'Telefone:', style: 'labelCampo', border: [false, false, false, false] },
              { text: telefoneUsuario, style: 'valorCampo', border: [false, false, false, false] },
            ],
            [
              { text: 'Quantidade de imagens:', style: 'labelCampo', border: [false, false, false, false] },
              { text: String(listaImagens.length), style: 'valorCampo', border: [false, false, false, false] },
            ],
            [
              { text: 'Solicitação:', style: 'labelCampo', border: [false, false, false, false] },
              { text: perguntaUsuario, style: 'valorCampo', border: [false, false, false, false] },
            ],
            [
              { text: 'Gerado em:', style: 'labelCampo', border: [false, false, false, false] },
              { text: dataHora, style: 'valorCampo', border: [false, false, false, false] },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 18],
      },
    ];

    if (listaImagens.length) {
      content.push(
        {
          text: 'IMAGENS ENVIADAS',
          style: 'secaoAzul',
          margin: [0, 0, 0, 6],
        },
        linhaSecao('#0066cc')
      );

      listaImagens.forEach((img, index) => {
        const base64 = img.base64 || img.imagem_base64 || img.data || img.media || '';
        const mime = img.mime || img.mimeType || img.imagem_mime || 'image/jpeg';
        const fileName = limpar(img.fileName || img.filename || `imagem-${index + 1}.jpg`, `imagem-${index + 1}.jpg`);
        const dataUrl = base64ParaDataUrl(base64, mime);

        content.push({
          text: `Imagem ${index + 1} - ${fileName}`,
          style: 'labelCampo',
          margin: [0, 4, 0, 6],
        });

        if (dataUrl) {
          content.push({
            image: dataUrl,
            fit: [500, 300],
            alignment: 'center',
            margin: [0, 0, 0, 16],
          });
        } else {
          content.push({
            text: 'Imagem não recebida ou base64 inválido.',
            style: 'textoObservacao',
            margin: [0, 0, 0, 16],
          });
        }
      });
    } else {
      content.push({
        text: 'Nenhuma imagem foi recebida para anexar ao relatório.',
        style: 'textoObservacao',
        margin: [0, 0, 0, 18],
      });
    }

    content.push(
      {
        text: 'ANÁLISE TÉCNICA',
        style: 'secaoVerde',
        margin: [0, 4, 0, 6],
      },
      linhaSecao('#168a3a'),
      ...montarBlocosTexto(analiseTexto),
      avisoImportante(
        'IMPORTANTE: Esta análise é preliminar e baseada nas imagens enviadas pelo usuário. A adoção de medidas deve ser validada por profissional habilitado e, quando aplicável, por inspeção no local.'
      )
    );

    const pdfBuffer = await gerarPdfBuffer(docBase(content, dataHora));

    const fileName = `analise-imagens-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar PDF da análise de imagens:', error);

    return res.status(500).json({
      error: 'Erro ao gerar PDF da análise de imagens',
      details: error.message,
    });
  }
});

/**
 * 404 precisa ficar depois de todas as rotas.
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
  });
});

/**
 * app.listen precisa ficar no final.
 */
app.listen(PORT, () => {
  console.log(`IA Safety PDFMake API rodando na porta ${PORT}`);
});

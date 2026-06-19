import jsPDF from "jspdf";

export type EmpresaContrato = {
  razao_social?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  nome_socio?: string | null;
  logo_base64?: string | null;
};

export type RepContrato = {
  nome: string;
  regiao?: string | null;
  tipo_pessoa?: "juridica" | "fisica" | null;
  razao_social?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  nome_socio?: string | null;
  cpf?: string | null;
  nome_completo?: string | null;
  rg?: string | null;
  data_nascimento?: string | null;
  percentual_padrao: number;
};

const enderecoCompleto = (e: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}) =>
  [
    [e.endereco, e.numero].filter(Boolean).join(", "),
    e.bairro,
    [e.cidade, e.estado].filter(Boolean).join("/"),
    e.cep ? `CEP ${e.cep}` : null,
  ]
    .filter(Boolean)
    .join(" - ");

const dataPorExtenso = (d = new Date()) => {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
};

export function gerarContratoPDF(empresa: EmpresaContrato, rep: RepContrato) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 25;
  const maxW = pageW - margin * 2;

  // Arial não está embutida no jsPDF; helvetica é a substituta padrão equivalente.
  const FONT = "helvetica";
  const FONT_SIZE = 12;
  // Espaçamento 1,5: altura da linha em mm para fonte 12pt (≈4.23mm) × 1.5
  const LINE_H = (FONT_SIZE * 0.3528) * 1.5;

  doc.setFont(FONT, "normal");
  doc.setFontSize(FONT_SIZE);
  doc.setLineHeightFactor(1.5);

  let y = margin;

  const ensure = (need = LINE_H) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ---- Cabeçalho com logo ----
  if (empresa.logo_base64) {
    try {
      const raw = empresa.logo_base64;
      const dataUrl = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
      const fmt = /image\/(jpe?g)/i.test(dataUrl) ? "JPEG" : "PNG";
      const logoW = 60; // largura máxima 60mm
      // estima altura proporcional (assume 1:1 se não conseguir medir)
      const props = (doc as any).getImageProperties?.(dataUrl);
      const ratio = props && props.width && props.height ? props.height / props.width : 0.5;
      const logoH = Math.min(35, logoW * ratio);
      doc.addImage(dataUrl, fmt, (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 6;
    } catch {
      // ignore erros de logo
    }
  }

  // Título
  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.text("CONTRATO REPRESENTAÇÃO COMERCIAL AUTÔNOMA", pageW / 2, y, { align: "center" });
  y += LINE_H * 2;
  doc.setFont(FONT, "normal");

  // Quebra texto em linhas respeitando maxW (sem confiar em splitTextToSize p/ justificar)
  const wrapLines = (text: string, width: number): string[] => {
    const out: string[] = [];
    for (const paragraph of text.split(/\n/)) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) { out.push(""); continue; }
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (doc.getTextWidth(test) > width && line) {
          out.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    }
    return out;
  };

  // Renderiza uma linha justificada distribuindo o espaço extra entre as palavras
  const drawJustifiedLine = (line: string, x: number, yy: number, width: number) => {
    const words = line.split(" ").filter(Boolean);
    if (words.length <= 1) { doc.text(line, x, yy); return; }
    const wordsWidth = words.reduce((s, w) => s + doc.getTextWidth(w), 0);
    const gap = (width - wordsWidth) / (words.length - 1);
    let cx = x;
    for (let i = 0; i < words.length; i++) {
      doc.text(words[i], cx, yy);
      cx += doc.getTextWidth(words[i]) + gap;
    }
  };

  const writeParagraph = (
    text: string,
    opts: { boldTitle?: string; align?: "left" | "center" | "justify"; spacing?: number } = {}
  ) => {
    const align = opts.align ?? "justify";

    // Título em negrito (em linha própria)
    if (opts.boldTitle) {
      ensure();
      doc.setFont(FONT, "bold");
      doc.text(opts.boldTitle + " -", margin, y);
      y += LINE_H;
      doc.setFont(FONT, "normal");
    } else {
      doc.setFont(FONT, "normal");
    }

    const lines = wrapLines(text, maxW);
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      ensure();
      const isLast = i === lines.length - 1;
      if (align === "center") {
        doc.text(ln, pageW / 2, y, { align: "center" });
      } else if (align === "justify" && !isLast && ln.includes(" ")) {
        drawJustifiedLine(ln, margin, y, maxW);
      } else {
        doc.text(ln, margin, y);
      }
      y += LINE_H;
    }
    y += opts.spacing ?? 2;
  };

  const empresaRazao = empresa.razao_social || "[RAZÃO SOCIAL DA EMPRESA]";
  const empresaCnpj = empresa.cnpj || "[CNPJ DA EMPRESA]";
  const empresaEnd = enderecoCompleto(empresa) || "[ENDEREÇO COMPLETO DA EMPRESA]";
  const empresaSocio = empresa.nome_socio || "[NOME DO SÓCIO DA EMPRESA]";
  const isPF = rep.tipo_pessoa === "fisica";
  const repNome = isPF ? (rep.nome_completo || rep.nome) : (rep.razao_social || rep.nome || "[RAZÃO SOCIAL DO REPRESENTANTE]");
  const repDocLabel = isPF ? "CPF" : "CNPJ";
  const repDoc = isPF ? (rep.cpf || "[CPF DO REPRESENTANTE]") : (rep.cnpj || "[CNPJ DO REPRESENTANTE]");
  const repEnd = enderecoCompleto(rep) || "[ENDEREÇO COMPLETO DO REPRESENTANTE]";
  const repRegiao = rep.regiao || "[REGIÃO DO REPRESENTANTE]";
  const repSocio = isPF ? (rep.nome_completo || rep.nome) : (rep.nome_socio || "[NOME DO SÓCIO DO REPRESENTANTE]");
  const pct = Number(rep.percentual_padrao ?? 0).toFixed(2).replace(".", ",");

  const aberturaRep = isPF
    ? `${repNome}, ${repDocLabel} Nº ${repDoc}, End.: ${repEnd}, doravante denominado(a) REPRESENTANTE`
    : `${repNome}, ${repDocLabel} Nº ${repDoc}, End.: ${repEnd}, neste ato representada por seu sócio ao final identificado doravante denominado REPRESENTANTE`;

  writeParagraph(
    `Pelo presente instrumento de contrato de representação comercial que fazem entre si, de um lado a empresa ${empresaRazao}, inscrita no CNPJ sob n°. ${empresaCnpj}, com sede à ${empresaEnd}, neste ato representado por seu sócio administrador ${empresaSocio}, doravante denominada REPRESENTADA, e do outro lado, ${aberturaRep}, tem entre si justo e acertado o quanto segue:`
  );

  const clausulas: [string, string][] = [
    ["CLÁUSULA PRIMEIRA", "A REPRESENTADA confere ao REPRESENTANTE a representação comercial dos artigos de sua produção, de modo a permitir-lhe que promova a venda nas condições estipuladas no presente contrato. Os produtos representados serão os seguintes: Amortecedores de suspensão e cabine da linha pesada (ônibus e caminhão)."],
    ["CLÁUSULA SEGUNDA", "O presente contrato terá prazo de 12 (doze) meses de duração, sem qualquer vínculo empregatício com a REPRESENTADA, podendo ser renovado se for interesse das partes envolvidas."],
    ["CLÁUSULA TERCEIRA", "A REPRESENTADA nomeia o REPRESENTANTE ora designado para agenciamento de propostas ou pedidos de compra de produtos industrializados ou mesmo os comercializados por ela, destinados aos clientes considerados ativos do representante. Parágrafo 1º - Os produtos terão seus preços especificados nas Listas de Preço e Políticas Comerciais enviadas ao REPRESENTANTE e serão revistos sempre que necessário a critério da REPRESENTADA. Parágrafo 2º - Os contratantes poderão de comum acordo e por escrito, incluir ou excluir produtos na lista de preço."],
    ["CLÁUSULA QUARTA", "O REPRESENTANTE promoverá a venda desses produtos, agenciando as propostas junto aos clientes cadastrados por ele, de acordo com a Política Comercial em vigor, assim como as orientações e circulares emitidas pela REPRESENTADA. Parágrafo Único: O REPRESENTANTE não poderá, salvo autorização expressa da REPRESENTADA, conceder descontos, abatimentos ou dilações de prazos, nem agir em desacordo com as instruções recebidas por ela."],
    ["CLÁUSULA QUINTA", `O REPRESENTANTE desempenhará suas atividades de representação comercial promovendo a venda dos produtos da REPRESENTADA, no Estado de ${repRegiao}, além da área inicialmente estabelecida no contrato principal, poderá atuar comercialmente em outras regiões do território nacional, desde que identificada oportunidade de negócio decorrente de relacionamento comercial pré-existente, contato direto com compradores, clientes ou potenciais clientes, ou mediante autorização prévia da REPRESENTADA.`],
    ["CLÁUSULA SEXTA", "Os pedidos efetivados pelo REPRESENTANTE deverão ser enviados a REPRESENTADA com antecedência mínima de 10 (dez) dias da data de entrega dos produtos, através de e-mail a fim de que as mercadorias comercializadas possam ser providenciadas em tempo hábil. Parágrafo 1º – A REPRESENTADA poderá, conforme critérios administrativos e comerciais internos, rejeitar o pedido efetuado pelo REPRESENTANTE, informando-o por escrito de tal decisão, reservando-se o direito de não revelar os motivos da recusa. Parágrafo 2º - O REPRESENTANTE está ciente de que o prazo estabelecido na cláusula sexta deve ser rigorosamente respeitado para que os produtos sejam entregues na data aprazada, comprometendo-se a informar os compradores quando houver alteração na data de entrega em razão da não observância do prazo estipulado na cláusula sexta."],
    ["CLÁUSULA SÉTIMA", `O REPRESENTANTE fará jus ao recebimento de uma comissão no valor correspondente a ${pct}% sobre o total das vendas efetivamente realizadas. O pagamento dessa comissão será efetuado até o dia 10 do mês subsequente ao mês em que for realizado o faturamento das vendas.`],
    ["CLÁUSULA OITAVA", "O REPRESENTANTE poderá exercer suas atividades para outra empresa, ou efetuar negócio em seu nome por conta própria, desde que não se trate de atividade que resulte concorrência à REPRESENTADA. Parágrafo Único – Estabelece-se expressa proibição de atuar, direta ou indiretamente, com produtos concorrentes aos da REPRESENTADA, em cujo caso se procederá à automática rescisão por justa causa do presente contrato."],
    ["CLÁUSULA NONA", "O REPRESENTANTE fica obrigado a fornecer à REPRESENTADA, quando lhe forem solicitadas, informações sobre o andamento dos negócios a seu cargo, devendo dedicar-se à REPRESENTADA promovendo os seus produtos."],
    ["CLÁUSULA DÉCIMA", "Salvo autorização expressa, não poderá o REPRESENTANTE, conceder abatimentos, descontos ou dilações, nem agir em desacordo com as instruções da REPRESENTADA."],
    ["CLÁUSULA DÉCIMA PRIMEIRA", "O REPRESENTANTE poderá ser constituído mandatário, com poderes especiais, para conclusão de negócios ou gestões de cobrança, devendo agir na estrita conformidade do mandato que lhe foi outorgado, ficando sujeito às prescrições legais relativas ao mandato mercantil. Parágrafo Único: Não fará jus a qualquer tipo de pagamento quando, a título de cooperação, o REPRESENTANTE desempenhe, temporariamente e por solicitação da REPRESENTADA, atribuições diversas dos previstos no presente contrato, desde que seja dentro da área estipulada de trabalho."],
    ["CLÁUSULA DÉCIMA SEGUNDA", "As despesas necessárias ao exercício normal da representação, ora concedida, ligadas à condução de mostruários etc., correm por conta do REPRESENTANTE, e as que se referirem a frete de mercadorias devolvidas, fiscalização, propaganda etc. serão de responsabilidade da REPRESENTADA, inclusive os impostos sobre elas incidentes."],
    ["CLÁUSULA DÉCIMA TERCEIRA", "O REPRESENTANTE se responsabiliza pela conservação e manutenção do mostruário que lhe é entregue pela REPRESENTADA."],
    ["CLÁUSULA DÉCIMA QUARTA", "O REPRESENTANTE poderá firmar contratos com outros representantes, pessoas jurídicas ou físicas, ou mesmo ter empregados vendedores, sempre sob sua única exclusiva responsabilidade jurídica, se assim o achar pertinente para expansão das suas vendas, sendo que qualquer trato deverá se efetuar sempre entre REPRESENTANTE e REPRESENTADA assinantes deste contrato e em nenhuma hipótese através de terceiros. Parágrafo 1º – Na hipótese do representante firmar contratos em regime CLT para o cumprimento deste contrato, deverá encaminhar juntamente com a nota fiscal de serviços, cópia dos seguintes documentos referentes aos seus empregados designados para a prestação dos serviços: registro de empregado, guia de recolhimento da Previdência Social (GPS), guia de recolhimento do FGTS e informações à Previdência Social (GFIP) e folha de pagamento. Parágrafo 2º - O descumprimento, pelo REPRESENTANTE, das obrigações previstas no parágrafo anterior, dará à contratante o direito de sustar o pagamento previsto na cláusula 3 até que sejam apresentados os documentos mencionados no parágrafo segundo. Parágrafo 3º – A REPRESENTANTE responde, exclusiva e diretamente, por todos e quaisquer atos praticados por seus empregados ou prepostos que deles decorram a obrigação e/ou necessidade de ressarcimento de prejuízos, danos materiais, patrimoniais ou moral, conforme o art. 932, III, do Código Civil, não podendo a REPRESENTADA ser responsabilizada por eles a nenhum título."],
    ["CLÁUSULA DÉCIMA QUINTA", "A REPRESENTADA poderá nomear outros REPRESENTANTES para expansão das suas vendas a nível local, estadual ou nacional, com prévio comunicado aquele REPRESENTANTE que for afetado, mas respeitando sempre aqueles clientes já cadastrados por ele e que tenham comprado nos últimos 90 (Noventa) dias. Parágrafo único: A REPRESENTADA informará imediatamente ao REPRESENTANTE no caso de consulta direta ao Departamento Comercial de cliente não cadastrado, mas da sua área de trabalho, o nome, endereço e telefone, para que o REPRESENTANTE efetue visita e possa cadastrá-lo como seu cliente, se efetivada a compra."],
    ["CLÁUSULA DÉCIMA SEXTA", "Serão considerados motivos justos para rescisão do contrato pela REPRESENTADA: a) desídia do REPRESENTANTE no cumprimento das obrigações previstas neste instrumento; b) a prática pelo REPRESENTANTE de atos que importem em descrédito comercial da REPRESENTADA; c) a condenação definitiva por crime considerado infamante; d) o inadimplemento da obrigação de respeitar a exclusividade em favor da REPRESENTADA; e) força maior."],
    ["CLÁUSULA DÉCIMA SÉTIMA", "Serão considerados motivos justos para rescisão do contrato pelo REPRESENTANTE: a) redução de sua esfera de atividade em desacordo com as cláusulas do contrato; b) a imposição de preços abusivos na sua área de atuação, com o objetivo de impedir sua operação normal; c) o não pagamento da ajuda de custo e/ou comissão. Parágrafo 1°. - O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio escrito de 30 (trinta) dias. Na hipótese de rescisão imotivada por iniciativa da REPRESENTADA, será devida ao REPRESENTANTE indenização correspondente a 1/12 (um doze avos) do total das comissões auferidas durante a vigência do contrato, conforme Lei nº 4.886/65. Parágrafo 2°. - A indenização não será devida quando a rescisão ocorrer por iniciativa do REPRESENTANTE, sem justo motivo, ou por justa causa atribuída ao REPRESENTANTE, sendo devidas apenas as comissões pendentes até a data do término do contrato. Parágrafo 3°. - Caso a rescisão se dê por motivo justo causado pela REPRESENTADA, ficará assegurado ao REPRESENTANTE o direito à indenização legal."],
    ["CLÁUSULA DÉCIMA OITAVA", "O fato de o REPRESENTANTE ter que se dedicar com zelo e lealdade à representação, expandir os negócios sob sua responsabilidade, e prestar colaboração excepcional a pedido da REPRESENTADA, incluindo tarefas não previstas neste contrato, não transforma a relação de representação comercial em uma relação de emprego."],
    ["CLÁUSULA DÉCIMA NONA – DA CONFIDENCIALIDADE", "O REPRESENTANTE compromete-se a manter absoluto sigilo e confidencialidade sobre todas as informações, dados, documentos, estratégias comerciais, políticas de preços, listas de clientes, fornecedores, processos, projetos, informações técnicas, financeiras e quaisquer outros dados de caráter confidencial aos quais tenha acesso em razão da execução deste contrato. As informações confidenciais não poderão ser divulgadas, reproduzidas, compartilhadas ou utilizadas para fins diversos da execução das atividades previstas neste instrumento, sem a prévia e expressa autorização por escrito da REPRESENTADA. A obrigação de confidencialidade permanecerá vigente durante toda a vigência deste contrato e por um período de 05 (cinco) anos após o seu término, independentemente do motivo da rescisão. O descumprimento desta cláusula sujeitará o REPRESENTANTE à responsabilização por eventuais perdas e danos causados à REPRESENTADA, sem prejuízo das demais medidas judiciais cabíveis."],
    ["CLÁUSULA VIGÉSIMA", "Os casos omissos serão regulados pelos preceitos da Lei nº 4.886, de 9 de dezembro de 1.965, com a nova redação da Lei nº 8.420/92, pelo Código Comercial e pelos princípios gerais de Direito. Fica eleito o foro do domicílio do REPRESENTANTE, de acordo com o Artigo 39 da Lei 8.420 de 8 de maio de 1.992, para discussão dos termos do presente contrato e cobrança dos valores dele derivados."],
  ];

  for (const [titulo, texto] of clausulas) {
    writeParagraph(texto, { boldTitle: titulo, spacing: 3 });
  }

  writeParagraph(
    "E por estarem assim justos e contratados, REPRESENTADA e REPRESENTANTE firmam o presente instrumento em 2 (duas) vias de igual teor, perante as testemunhas que com elas subscrevem abaixo, para que produza todos os efeitos de Direito.",
    { spacing: 8 }
  );

  writeParagraph(`Local e data: São Caetano do Sul, ${dataPorExtenso()}.`, { align: "left", spacing: 20 });

  // Assinaturas - centralizadas com espaço de rubrica
  ensure(35);
  const sigW = (maxW - 20) / 2;
  doc.line(margin, y, margin + sigW, y);
  doc.line(margin + sigW + 20, y, margin + sigW + 20 + sigW, y);
  y += LINE_H;
  doc.setFont(FONT, "bold");
  doc.text("REPRESENTADA", margin + sigW / 2, y, { align: "center" });
  doc.text("REPRESENTANTE", margin + sigW + 20 + sigW / 2, y, { align: "center" });
  y += LINE_H;
  doc.setFont(FONT, "normal");
  doc.text(empresaSocio, margin + sigW / 2, y, { align: "center" });
  doc.text(repSocio, margin + sigW + 20 + sigW / 2, y, { align: "center" });

  const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  const dt = new Date().toISOString().slice(0, 10);
  doc.save(`contrato_${slug(rep.nome)}_${dt}.pdf`);
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // 1. Workspace / Organization padrão
  const org = await prisma.organization.upsert({
    where: { id: "default-org" },
    update: {},
    create: {
      id: "default-org",
      name: "Snack Fácil",
    },
  });

  // 2. Usuário administrador inicial (lido estritamente do .env)
  const rawAdminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : "";
  const adminPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : "";
  const adminName = process.env.ADMIN_NAME ? process.env.ADMIN_NAME.trim() : "Administrador Snack Fácil";

  if (!rawAdminEmail || !adminPassword) {
    throw new Error(
      "VARIÁVEIS OBRIGATÓRIAS AUSENTES: ADMIN_EMAIL e ADMIN_PASSWORD devem estar definidas no arquivo .env para executar o seed com segurança. Nunca utilize senhas padrão no código ou em produção."
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: rawAdminEmail },
    update: {
      passwordHash,
      name: adminName,
      role: "ADMIN",
      active: true,
    },
    create: {
      email: rawAdminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
      active: true,
      mustChangePassword: true,
      sessionVersion: 1,
      organizationId: org.id,
    },
  });
  console.log(`Usuário administrador garantido: ${user.email} (Perfil: ADMIN | Troca de senha no primeiro login: ativa)`);

  // Migração segura: vincula lançamentos existentes sem autor ao admin
  const unassignedTxs = await prisma.transaction.updateMany({
    where: { createdById: null },
    data: { createdById: user.id },
  });
  if (unassignedTxs.count > 0) {
    console.log(`Autoria preservada: ${unassignedTxs.count} lançamentos históricos vinculados ao administrador.`);
  }

  // 3. Conta padrão inicial
  let defaultAccount = await prisma.account.findFirst({
    where: { organizationId: org.id },
  });

  if (!defaultAccount) {
    defaultAccount = await prisma.account.create({
      data: {
        name: "Conta Principal",
        type: "BANK",
        initialBalanceCents: 0,
        active: true,
        organizationId: org.id,
      },
    });
    console.log("Conta principal criada com saldo inicial R$ 0,00.");
  }

  // 4. Categorias Iniciais (Hierárquicas)
  const categoriesDefinition = [
    // ENTRADAS
    {
      name: "Vendas das máquinas",
      kind: "INCOME",
      dreLine: "RECEITA_BRUTA",
      sortOrder: 10,
      subcategories: ["Venda em dinheiro", "Venda por cartão/pix"],
    },
    {
      name: "Outras receitas",
      kind: "INCOME",
      dreLine: "RECEITA_BRUTA",
      sortOrder: 20,
      subcategories: ["Venda de ativos / Sucata", "Outras entradas operacionais"],
    },
    {
      name: "Rendimentos financeiros",
      kind: "INCOME",
      dreLine: "RECEITAS_FINANCEIRAS",
      sortOrder: 30,
      subcategories: ["Rendimento de aplicações", "Juros recebidos"],
    },

    // SAÍDAS
    {
      name: "Impostos sobre vendas",
      kind: "EXPENSE",
      dreLine: "DEDUCOES",
      sortOrder: 40,
      subcategories: ["Simples Nacional", "Tributos sobre faturamento"],
    },
    {
      name: "Taxas de cartão e pix",
      kind: "EXPENSE",
      dreLine: "DEDUCOES",
      sortOrder: 50,
      subcategories: ["Taxa de maquininha de cartão", "Taxa de gateway Pix / QR Code"],
    },
    {
      name: "Mercadoria para revenda",
      kind: "EXPENSE",
      dreLine: "CMV",
      sortOrder: 60,
      subcategories: ["Snacks e salgadinhos", "Bebidas e refrigerantes", "Doces e chocolates"],
    },
    {
      name: "Ocupação (aluguel/energia do ponto, comissão do local)",
      kind: "EXPENSE",
      dreLine: "DESPESAS_OPERACIONAIS",
      sortOrder: 70,
      subcategories: ["Aluguel e energia do ponto", "Comissão sobre vendas do ponto"],
    },
    {
      name: "Manutenção e reparo das máquinas",
      kind: "EXPENSE",
      dreLine: "DESPESAS_OPERACIONAIS",
      sortOrder: 80,
      subcategories: ["Peças de reposição", "Serviços técnicos e revisão"],
    },
    {
      name: "Transporte e combustível",
      kind: "EXPENSE",
      dreLine: "DESPESAS_OPERACIONAIS",
      sortOrder: 90,
      subcategories: ["Combustível para abastecimento", "Manutenção e pedágio"],
    },
    {
      name: "Serviços (contabilidade, telemetria, software, internet)",
      kind: "EXPENSE",
      dreLine: "DESPESAS_OPERACIONAIS",
      sortOrder: 100,
      subcategories: ["Contabilidade", "Telemetria e chip das máquinas", "Softwares e sistemas"],
    },
    {
      name: "Pessoal (pró-labore, ajudantes, encargos)",
      kind: "EXPENSE",
      dreLine: "DESPESAS_OPERACIONAIS",
      sortOrder: 110,
      subcategories: ["Pró-labore do sócio", "Diárias de ajudante para abastecimento"],
    },
    {
      name: "Marketing",
      kind: "EXPENSE",
      dreLine: "DESPESAS_OPERACIONAIS",
      sortOrder: 120,
      subcategories: ["Material promocional e adesivos", "Divulgação e parcerias"],
    },
    {
      name: "Outras despesas",
      kind: "EXPENSE",
      dreLine: "DESPESAS_OPERACIONAIS",
      sortOrder: 130,
      subcategories: ["Despesas gerais e administrativas", "Materiais de limpeza"],
    },
    {
      name: "Juros e tarifas bancárias",
      kind: "EXPENSE",
      dreLine: "DESPESAS_FINANCEIRAS",
      sortOrder: 140,
      subcategories: ["Tarifas de manutenção de conta", "Juros e encargos bancários"],
    },
    {
      name: "Impostos sobre o lucro",
      kind: "EXPENSE",
      dreLine: "IMPOSTOS_LUCRO",
      sortOrder: 150,
      subcategories: ["IRPJ / CSLL"],
    },
    {
      name: "Investimentos (compra de máquinas e equipamentos)",
      kind: "EXPENSE",
      dreLine: "FORA_DRE",
      sortOrder: 160,
      subcategories: ["Aquisição de vending machines", "Equipamentos, caixas e ferramentas"],
    },
  ];

  const categoryMap = new Map();

  for (const cat of categoriesDefinition) {
    let parent = await prisma.category.findFirst({
      where: {
        organizationId: org.id,
        name: cat.name,
        parentId: null,
      },
    });

    if (!parent) {
      parent = await prisma.category.create({
        data: {
          name: cat.name,
          kind: cat.kind,
          dreLine: cat.dreLine,
          sortOrder: cat.sortOrder,
          organizationId: org.id,
        },
      });
    }

    categoryMap.set(cat.name, parent);

    // Subcategorias
    let subOrder = 1;
    for (const subName of cat.subcategories) {
      const existingSub = await prisma.category.findFirst({
        where: {
          organizationId: org.id,
          name: subName,
          parentId: parent.id,
        },
      });

      if (!existingSub) {
        const createdSub = await prisma.category.create({
          data: {
            name: subName,
            kind: cat.kind,
            dreLine: cat.dreLine,
            parentId: parent.id,
            sortOrder: subOrder++,
            organizationId: org.id,
          },
        });
        categoryMap.set(`${cat.name} -> ${subName}`, createdSub);
      } else {
        categoryMap.set(`${cat.name} -> ${subName}`, existingSub);
      }
    }
  }

  console.log("Plano de contas e categorias iniciais cadastrado com sucesso!");

  // 5. Dados de Exemplo (Opcional, com flag WITH_DEMO=true)
  if (process.env.WITH_DEMO === "true") {
    console.log("Criando dados fictícios de demonstração dos últimos meses...");
    const existingTxCount = await prisma.transaction.count({
      where: { organizationId: org.id },
    });

    if (existingTxCount === 0) {
      // Cria transações fictícias nos últimos 4 meses
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0 a 11

      const sampleMonths = [
        new Date(Date.UTC(currentYear, currentMonth - 3, 10)),
        new Date(Date.UTC(currentYear, currentMonth - 2, 10)),
        new Date(Date.UTC(currentYear, currentMonth - 1, 10)),
        new Date(Date.UTC(currentYear, currentMonth, 10)),
      ];

      const catVendaCartao = categoryMap.get("Vendas das máquinas -> Venda por cartão/pix");
      const catVendaDinheiro = categoryMap.get("Vendas das máquinas -> Venda em dinheiro");
      const catTaxasCartao = categoryMap.get("Taxas de cartão e pix -> Taxa de maquininha de cartão");
      const catImpostosVendas = categoryMap.get("Impostos sobre vendas -> Simples Nacional");
      const catCmvSnacks = categoryMap.get("Mercadoria para revenda -> Snacks e salgadinhos");
      const catCmvBebidas = categoryMap.get("Mercadoria para revenda -> Bebidas e refrigerantes");
      const catOcupacao = categoryMap.get("Ocupação (aluguel/energia do ponto, comissão do local) -> Aluguel e energia do ponto");
      const catManutencao = categoryMap.get("Manutenção e reparo das máquinas -> Peças de reposição");
      const catTransporte = categoryMap.get("Transporte e combustível -> Combustível para abastecimento");
      const catServicos = categoryMap.get("Serviços (contabilidade, telemetria, software, internet) -> Telemetria e chip das máquinas");
      const catProLabore = categoryMap.get("Pessoal (pró-labore, ajudantes, encargos) -> Pró-labore do sócio");
      const catTarifasBancarias = categoryMap.get("Juros e tarifas bancárias -> Tarifas de manutenção de conta");
      const catRendimento = categoryMap.get("Rendimentos financeiros -> Rendimento de aplicações");
      const catInvestimento = categoryMap.get("Investimentos (compra de máquinas e equipamentos) -> Aquisição de vending machines");

      for (let i = 0; i < sampleMonths.length; i++) {
        const mDate = sampleMonths[i];
        const year = mDate.getUTCFullYear();
        const month = mDate.getUTCMonth();

        const transactionsToCreate = [
          // Receitas
          {
            date: new Date(Date.UTC(year, month, 5)),
            kind: "INCOME",
            amountCents: 425000 + i * 25000, // R$ 4.250,00 + evolução
            description: "Venda máquinas cartão e pix",
            categoryId: catVendaCartao.id,
          },
          {
            date: new Date(Date.UTC(year, month, 12)),
            kind: "INCOME",
            amountCents: 85000 + i * 5000, // R$ 850,00
            description: "Venda máquinas moedas e notas",
            categoryId: catVendaDinheiro.id,
          },
          {
            date: new Date(Date.UTC(year, month, 28)),
            kind: "INCOME",
            amountCents: 3500, // R$ 35,00
            description: "Rendimento CDB diário",
            categoryId: catRendimento.id,
          },
          // Deduções
          {
            date: new Date(Date.UTC(year, month, 6)),
            kind: "EXPENSE",
            amountCents: 15300 + i * 900, // R$ 153,00
            description: "Taxas cartão e adquirente",
            categoryId: catTaxasCartao.id,
          },
          {
            date: new Date(Date.UTC(year, month, 20)),
            kind: "EXPENSE",
            amountCents: 20400 + i * 1200, // R$ 204,00
            description: "DAS Simples Nacional",
            categoryId: catImpostosVendas.id,
          },
          // CMV
          {
            date: new Date(Date.UTC(year, month, 7)),
            kind: "EXPENSE",
            amountCents: 110000 + i * 8000, // R$ 1.100,00
            description: "Reposição salgadinhos atacado",
            categoryId: catCmvSnacks.id,
          },
          {
            date: new Date(Date.UTC(year, month, 8)),
            kind: "EXPENSE",
            amountCents: 78000 + i * 6000, // R$ 780,00
            description: "Reposição bebidas e refrigerantes",
            categoryId: catCmvBebidas.id,
          },
          // Despesas Operacionais
          {
            date: new Date(Date.UTC(year, month, 10)),
            kind: "EXPENSE",
            amountCents: 45000, // R$ 450,00
            description: "Aluguel e energia do ponto academia",
            categoryId: catOcupacao.id,
          },
          {
            date: new Date(Date.UTC(year, month, 14)),
            kind: "EXPENSE",
            amountCents: 12000, // R$ 120,00
            description: "Gasolina rotas de abastecimento",
            categoryId: catTransporte.id,
          },
          {
            date: new Date(Date.UTC(year, month, 15)),
            kind: "EXPENSE",
            amountCents: 9900, // R$ 99,00
            description: "Mensalidade telemetria e chip M2M",
            categoryId: catServicos.id,
          },
          {
            date: new Date(Date.UTC(year, month, 18)),
            kind: "EXPENSE",
            amountCents: 150000, // R$ 1.500,00
            description: "Pró-labore mensal sócio",
            categoryId: catProLabore.id,
          },
          // Despesas Financeiras
          {
            date: new Date(Date.UTC(year, month, 25)),
            kind: "EXPENSE",
            amountCents: 2990, // R$ 29,90
            description: "Cesta de serviços PJ",
            categoryId: catTarifasBancarias.id,
          },
        ];

        // Investimento inicial no primeiro mês da amostra
        if (i === 0) {
          transactionsToCreate.push({
            date: new Date(Date.UTC(year, month, 2)),
            kind: "EXPENSE",
            amountCents: 1200000, // R$ 12.000,00 (compra de máquina)
            description: "Entrada na compra de vending machine modelo V30",
            categoryId: catInvestimento.id,
          });
        }

        for (const tx of transactionsToCreate) {
          await prisma.transaction.create({
            data: {
              date: tx.date,
              kind: tx.kind,
              amountCents: tx.amountCents,
              description: tx.description,
              accountId: defaultAccount.id,
              categoryId: tx.categoryId,
              organizationId: org.id,
              createdById: user.id,
            },
          });
        }
      }
      console.log("Dados fictícios de demonstração criados com sucesso!");
    }
  }

  console.log("Seed finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

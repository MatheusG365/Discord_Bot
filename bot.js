import OpenAI from "openai";
import "dotenv/config";
import fs from "fs";

import {
  Client,
  GatewayIntentBits
} from "discord.js";


// ==========================================
// DISCORD
// ==========================================

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});


// ==========================================
// BOT ONLINE
// ==========================================

discord.once("ready", () => {
  console.log(`Bot conectado como ${discord.user.tag}`);
});


// ==========================================
// OPENROUTER / IA
// ==========================================

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});


// ==========================================
// INSTRUÇÕES DA IA
// ==========================================

const instructions = `
Você é um assistente pessoal especializado exclusivamente no mundo geek.

Você pode conversar somente sobre assuntos relacionados a:

- jogos
- videogames
- PC Gaming
- animes
- mangás
- filmes
- séries
- quadrinhos
- Marvel
- DC
- Pokémon
- Nintendo
- PlayStation
- Xbox
- cultura pop
- personagens fictícios
- universos fictícios
- atores, diretores e criadores quando relacionados a filmes, séries, jogos ou cultura geek
- hardware e tecnologia relacionada a jogos

REGRAS IMPORTANTES:

1. Nunca responda perguntas que não tenham relação com o mundo geek.

2. Se a pergunta não estiver relacionada ao mundo geek, responda EXATAMENTE:

"Desculpe, só posso responder perguntas relacionadas ao mundo geek."

3. Se o usuário mandar uma saudação responda somente a saudação e
"desculpe, só posso responder perguntas relacionadas ao mundo geek."

Exemplo:

"Olá! 😊 Desculpe, só posso responder perguntas relacionadas ao mundo geek."

4. Não tente responder parcialmente perguntas fora do mundo geek.

5. Considere o histórico da conversa.

Por exemplo:

Usuário:
Quem é Naruto?

Depois:
Quem é o pai dele?

A segunda pergunta continua sendo considerada geek por causa do contexto.

6. Responda sempre em português do Brasil.

7. Seja natural, amigável e objetivo.

8. Não invente informações.
`;


// ==========================================
// MODELOS
// ==========================================

const modelos = [
  "inclusionai/ling-3.0-flash-vl:free",
  "nex-agi/nex-n2.5-pro:free",
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3.5-lightning:free"
];


// ==========================================
// ARQUIVO DE MEMÓRIA
// ==========================================

const ARQUIVO_MEMORIA = "./memoria.json";

let memorias = carregarMemorias();


// ==========================================
// MEMÓRIA
// ==========================================

function carregarMemorias() {

  try {

    if (!fs.existsSync(ARQUIVO_MEMORIA)) {
      return {};
    }

    const dados = fs.readFileSync(
      ARQUIVO_MEMORIA,
      "utf-8"
    );

    return JSON.parse(dados);

  } catch (erro) {

    console.log("Erro ao carregar memória.");

    return {};
  }
}


// ==========================================
// SALVAR MEMÓRIA
// ==========================================

function salvarMemorias() {

  try {

    fs.writeFileSync(
      ARQUIVO_MEMORIA,
      JSON.stringify(memorias, null, 2)
    );

  } catch (erro) {

    console.log("Erro ao salvar memória.");
  }
}


// ==========================================
// PEGAR HISTÓRICO DO USUÁRIO
// ==========================================

function obterHistorico(userId) {

  if (!memorias[userId]) {
    memorias[userId] = [];
  }

  return memorias[userId];
}


// ==========================================
// ADICIONAR NA MEMÓRIA
// ==========================================

function adicionarNaMemoria(
  userId,
  role,
  content
) {

  const historico = obterHistorico(userId);

  historico.push({
    role,
    content
  });

  limitarMemoria(userId);

  salvarMemorias();
}


// ==========================================
// LIMITAR MEMÓRIA
// ==========================================

function limitarMemoria(userId) {

  const LIMITE = 20;

  const historico = obterHistorico(userId);

  if (historico.length > LIMITE) {

    memorias[userId] =
      historico.slice(-LIMITE);
  }
}


// ==========================================
// LIMPAR MEMÓRIA
// ==========================================

function limparMemoria(userId) {

  memorias[userId] = [];

  salvarMemorias();
}


// ==========================================
// CLASSIFICAR SE É GEEK
// ==========================================

async function perguntaEhGeek(
  userId,
  userInput
) {

  const historico = obterHistorico(userId);

  const historicoRecente = historico
    .slice(-6)
    .map(
      mensagem =>
        `${mensagem.role}: ${mensagem.content}`
    )
    .join("\n");


  const classificacaoInstructions = `
Você é um classificador de perguntas.

Sua única função é determinar se a pergunta do usuário
é relacionada ao mundo geek.

Considere como mundo geek:

- jogos
- videogames
- PC Gaming
- animes
- mangás
- filmes
- séries
- quadrinhos
- Marvel
- DC
- Pokémon
- Nintendo
- PlayStation
- Xbox
- cultura pop
- personagens fictícios
- universos fictícios
- atores relacionados a filmes e séries
- tecnologia relacionada a videogames

Considere também o histórico da conversa.

Exemplo:

Histórico:
Usuário: Quem é Naruto?
Assistente: Naruto é...

Pergunta:
Quem é o pai dele?

Resultado:
GEEK


Outro exemplo:

Pergunta:
Quanto é 50 + 30?

Resultado:
NAO_GEEK


Outro exemplo:

Pergunta:
Qual a capital do Brasil?

Resultado:
NAO_GEEK


Outro exemplo:

Pergunta:
Quem venceria Goku ou Superman?

Resultado:
GEEK


Você deve responder SOMENTE:

GEEK

ou

NAO_GEEK

Não explique sua resposta.
`;


  for (const modelo of modelos) {

    try {

      const response =
        await client.responses.create({

          model: modelo,

          input: [

            {
              role: "developer",
              content:
                classificacaoInstructions
            },

            {
              role: "user",
              content: `
Histórico da conversa:

${historicoRecente || "Nenhum histórico."}

Pergunta atual:

${userInput}
`
            }

          ]

        });


      const resultado =
        response.output_text
          .trim()
          .toUpperCase();


      return resultado === "GEEK";


    } catch (erro) {

      console.log(
        `Erro ao classificar usando ${modelo}`
      );
    }
  }


  return false;
}


// ==========================================
// DETECTAR SAUDAÇÃO
// ==========================================

function detectarSaudacao(texto) {

  const textoNormalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();


  const saudacoes = [

    {
      regex: /^(oi|ola|opa|e ai|eai|salve|fala|hey|hello)\b/i,
      resposta: "Olá! 😊"
    },

    {
      regex: /^bom dia\b/i,
      resposta: "Bom dia! 😊"
    },

    {
      regex: /^boa tarde\b/i,
      resposta: "Boa tarde! 😊"
    },

    {
      regex: /^boa noite\b/i,
      resposta: "Boa noite! 😊"
    }

  ];


  for (const saudacao of saudacoes) {

    if (saudacao.regex.test(textoNormalizado)) {

      return {
        temSaudacao: true,
        resposta: saudacao.resposta
      };

    }
  }


  return {
    temSaudacao: false,
    resposta: ""
  };
}


// ==========================================
// REMOVER SAUDAÇÃO
// ==========================================

function removerSaudacao(texto) {

  let resultado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");


  const saudacoes = [

    /^(oi|ola|opa|e ai|eai|salve|fala|hey|hello)\b[,.!?;:\s-]*/i,

    /^bom dia\b[,.!?;:\s-]*/i,

    /^boa tarde\b[,.!?;:\s-]*/i,

    /^boa noite\b[,.!?;:\s-]*/i

  ];


  for (const regex of saudacoes) {

    if (regex.test(resultado)) {

      resultado = resultado.replace(
        regex,
        ""
      );

      break;
    }
  }


  return resultado.trim();
}


// ==========================================
// IA PRINCIPAL
// ==========================================

async function perguntarIA(
  userId,
  userInput
) {

  const saudacao =
    detectarSaudacao(userInput);


  let perguntaParaIA = userInput;


  if (saudacao.temSaudacao) {

    perguntaParaIA =
      removerSaudacao(userInput);
  }


  // ==========================================
  // SOMENTE SAUDAÇÃO
  // ==========================================

  if (
    saudacao.temSaudacao &&
    !perguntaParaIA.trim()
  ) {

    return saudacao.resposta;
  }


  // ==========================================
  // VERIFICA SE É GEEK
  // ==========================================

  const geek =
    await perguntaEhGeek(
      userId,
      perguntaParaIA
    );


  // ==========================================
  // NÃO É GEEK
  // ==========================================

  if (!geek) {

    let mensagem =
      "Desculpe, só posso responder perguntas relacionadas ao mundo geek.";


    if (saudacao.temSaudacao) {

      mensagem =
        `${saudacao.resposta} ${mensagem}`;
    }


    return mensagem;
  }


  // ==========================================
  // É GEEK
  // ==========================================

  const historico =
    obterHistorico(userId);


  for (const modelo of modelos) {

    try {

      console.log(
        `Tentando modelo: ${modelo}`
      );


      const input = [

        {
          role: "developer",
          content: instructions
        },

        ...historico,

        {
          role: "user",
          content: perguntaParaIA
        }

      ];


      const stream =
        await client.responses.create({

          model: modelo,

          stream: true,

          input
        });


      let respostaCompleta = "";


      if (saudacao.temSaudacao) {

        respostaCompleta +=
          saudacao.resposta + "\n\n";
      }


      for await (const event of stream) {

        if (
          event.type ===
          "response.output_text.delta"
        ) {

          const texto =
            event.delta;

          respostaCompleta += texto;
        }
      }


      adicionarNaMemoria(
        userId,
        "user",
        userInput
      );


      adicionarNaMemoria(
        userId,
        "assistant",
        respostaCompleta
      );


      console.log(
        `Modelo usado: ${modelo}`
      );


      return respostaCompleta;


    } catch (erro) {

      console.log(
        `Erro no modelo ${modelo}`
      );

      console.log(
        erro?.error?.message ||
        erro?.message ||
        "Erro desconhecido"
      );

      console.log(
        "Tentando próximo modelo..."
      );
    }
  }


  return "Os modelos de IA estão indisponíveis no momento. Tente novamente depois.";
}


// ==========================================
// RECEBER MENSAGENS DO DISCORD
// ==========================================

discord.on(
  "messageCreate",
  async (message) => {

    // Ignora mensagens de outros bots
    if (message.author.bot) return;


    const texto =
      message.content.trim();


    if (!texto) return;


    try {

      // ==========================================
      // LIMPAR MEMÓRIA
      // ==========================================

      if (
        texto.toLowerCase() ===
        "limpar memoria"
      ) {

        limparMemoria(
          message.author.id
        );


        await message.reply(
          "Sua memória foi apagada. 🧠"
        );


        return;
      }


      // ==========================================
      // MOSTRAR DIGITANDO
      // ==========================================

      await message.channel.sendTyping();


      // ==========================================
      // PERGUNTAR PARA A IA
      // ==========================================

      const resposta =
        await perguntarIA(
          message.author.id,
          texto
        );


      if (!resposta) return;


      // ==========================================
      // DISCORD TEM LIMITE DE 2000 CARACTERES
      // ==========================================

      const partes =
        resposta.match(
          /[\s\S]{1,1900}/g
        ) || [];


      // ==========================================
      // ENVIAR RESPOSTA
      // ==========================================

      if (partes.length > 0) {

        await message.reply(
          partes[0]
        );
      }


      // ==========================================
      // ENVIAR PARTES RESTANTES
      // ==========================================

      for (
        let i = 1;
        i < partes.length;
        i++
      ) {

        await message.channel.send(
          partes[i]
        );
      }


    } catch (erro) {

      console.error(
        "Erro ao responder mensagem no Discord:",
        erro
      );


      try {

        await message.reply(
          "Desculpe, aconteceu um erro ao processar sua pergunta. Tente novamente."
        );

      } catch (erroResposta) {

        console.error(
          "Também não foi possível enviar a mensagem de erro:",
          erroResposta
        );
      }
    }
  }
);


// ==========================================
// LOGIN DO BOT
// ==========================================

discord
  .login(process.env.DISCORD_TOKEN)
  .then(() => {

    console.log(
      "Login do Discord realizado com sucesso."
    );

  })
  .catch((erro) => {

    console.error(
      "Erro ao conectar ao Discord:",
      erro
    );

  });

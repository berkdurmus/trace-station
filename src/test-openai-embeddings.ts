import { OpenAIEmbeddings } from "@langchain/openai";
import * as dotenv from "dotenv";

dotenv.config();

async function testOpenAIEmbeddings() {
  // Print out what parameters the constructor accepts
  console.log("Creating OpenAIEmbeddings with various parameters to test");

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    // Note the parameters we want to check
  });

  console.log("Embeddings created successfully");
}

testOpenAIEmbeddings()
  .then(() => console.log("Test completed"))
  .catch((err) => console.error("Error:", err));

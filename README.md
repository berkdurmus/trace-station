# TraceStation: Playwright Debug Agent

An AI-powered debugging assistant for Playwright tests that analyzes test failures and provides actionable recommendations.

## Features

- **Trace Analysis**: Identifies failure points and error patterns in your Playwright test traces
- **Context-aware Documentation**: Retrieves relevant Playwright documentation based on the failure context
- **Root Cause Diagnosis**: Determines the most likely cause of test failures
- **Actionable Recommendations**: Suggests specific fixes and best practices
- **Interactive Chat**: Discuss your test failures with an AI assistant specialized in Playwright testing
- **Retrieval Augmented Generation (RAG)**: Enhances AI responses with relevant Playwright documentation

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/trace-station.git
cd trace-station

# Install dependencies
npm install

# Build the project
npm run build

# Fetch+update docs for the first time
npm run update-docs
```

## Usage

### API Keys

The tool uses AI models that require API keys. You can provide them in several ways:


1. Use a .env file in the project root:
   ```
   ANTHROPIC_API_KEY = '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'
   OPENAI_API_KEY = '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'
   ```


### Analyzing a Trace File

```bash
# Basic analysis
npm run dev -- analyze path/to/onboarding-trace.zip

# Force update documentation during analysis
npm run dev -- analyze path/to/onboarding-trace.zip --update-docs

# Disable RAG functionality (don't use documentation)
npm run dev -- analyze path/to/onboarding-trace.zip --no-rag
```

### Interactive Chat

For a simple interactive chat with the trace analysis assistant, use the `chat` command:

```bash
# Start a basic chat session
npm run dev -- chat path/to/onboarding-trace.zip

# Force update documentation during chat
npm run dev -- chat path/to/onboarding-trace.zip --update-docs

# Save chat transcript to file
npm run dev -- chat path/to/onboarding-trace.zip -o chat-transcript.json
```

During the chat session:
- Type your questions about the test failure
- The assistant will respond with contextual answers based on the trace analysis
- Type 'exit' or 'quit' to end the chat session

### Using the Orchestrated Workflow

The orchestrated workflow provides more flexibility and control over the analysis process. It uses a workflow orchestrator that allows for conditional execution, retries, and potential parallelization of certain steps.

```bash
# Basic orchestrated analysis
npm run dev -- analyze-orchestrated path/to/onboarding-trace.zip

# With retries enabled (3 retries with exponential backoff)
npm run dev -- analyze-orchestrated path/to/onboarding-trace.zip -r

# Force update documentation during orchestrated analysis
npm run dev -- analyze-orchestrated path/to/onboarding-trace.zip --update-docs

# Disable RAG functionality (don't use documentation)
npm run dev -- analyze-orchestrated path/to/onboarding-trace.zip --no-rag

# With all options enabled
npm run dev -- analyze-orchestrated path/to/onboarding-trace.zip -r -c -p -v
```

Options for the orchestrated workflow:
- `-r, --retries`: Enable retries for agent calls (up to 3 retries with exponential backoff)
- `-c, --conditional`: Enable conditional context gathering (skips for low severity issues)
- `-p, --parallel`: Enable parallel diagnosis (experimental)
- `-v, --verbose`: Show detailed processing logs
- `-k, --api-key <key>`: Specify API key for Anthropic Claude
- `-o, --output <file>`: Save results to JSON file
- `--no-rag`: Disable Retrieval Augmented Generation (don't use documentation)

### Interactive Chat with Orchestrated Workflow

For interactive chat using the orchestrated workflow, use the `chat-orchestrated` command:

```bash
# Start a chat session using the orchestrated workflow
npm run dev -- chat-orchestrated path/to/onboarding-trace.zip

# With workflow options
npm run dev -- chat-orchestrated path/to/onboarding-trace.zip -r -c -p

# Force update documentation during chat
npm run dev -- chat-orchestrated path/to/onboarding-trace.zip --update-docs

# Save chat transcript to file
npm run dev -- chat-orchestrated path/to/onboarding-trace.zip -o chat-transcript.json
```

During the chat session:
- Type your questions about the test failure
- The assistant will respond with contextual answers based on the trace analysis
- Type 'exit' or 'quit' to end the chat session

## Development

```bash
# Run in development mode
npm run dev

# Fetch documentation sources
npm run fetch-docs

# Update documentation sources
npm run update-docs

# Enhance the documentation sources
npm run enhance-docs
```

## How It Works

TraceStation uses AI-powered workflows to analyze Playwright test failures. The system supports two types of workflows:

### 1. Standard Linear Workflow

The standard workflow processes trace data through a linear sequence of specialized AI agents:

```mermaid
flowchart TD
    A[User Input: Trace File] --> B[Load Trace File]
    B --> C[Parse Trace]
    C --> D[Initialize WorkflowState]
    
    subgraph "Linear Workflow Process"
        D --> E[TraceAnalysisAgent]
        E --> |Analysis Results| F[ContextAgent + RAG]
        F --> |Context Results| G[DiagnosisAgent]
        G --> |Diagnosis Results| H[RecommendationAgent]
    end
    
    H --> I[Generate Final Report]
    I --> J[Display Results to User]
    
    %% RAG Component
    R1[Playwright Docs] --> |Vector Embeddings| R2[Vector Store]
    R2 --> F
    
    %% Error Handling
    C -- Error --> E1[Error Handler]
    E -- Error --> E1
    F -- Error --> E1
    G -- Error --> E1
    H -- Error --> E1
    E1 --> J
    
    style A fill:#f9d5e5,stroke:#333
    style J fill:#eeeeee,stroke:#333
    style E fill:#d3f8e2,stroke:#333
    style F fill:#e3f2fd,stroke:#333
    style G fill:#fff9c4,stroke:#333
    style H fill:#ffccbc,stroke:#333
    style R1 fill:#e8eaf6,stroke:#333
    style R2 fill:#e8eaf6,stroke:#333
```

This workflow follows a predictable sequence:
1. **Trace Loading**: Loads and parses Playwright trace files (.trace or .zip)
2. **Analysis**: Identifies failure points and patterns in the test execution
3. **Context Gathering**: Retrieves relevant documentation using RAG
4. **Diagnosis**: Determines the root cause of the failure
5. **Recommendation**: Provides actionable suggestions to fix the issue

### 2. Orchestrated Workflow

The orchestrated workflow uses a more dynamic approach with an AI orchestrator that plans and coordinates the analysis:

```mermaid
flowchart TD
    A[User Input: Trace File] --> B[Load Trace File]
    B --> C[Parse Trace]
    C --> D[Initialize WorkflowState]
    
    subgraph "Orchestration Planning"
        D --> E[OrchestratorAgent]
        E --> F[Generate Execution Plan]
        F --> G[Create Task Dependencies]
    end
    
    subgraph "Dynamic Task Execution"
        G --> H[Topological Sort]
        H --> I{All Tasks Complete?}
        I -- No --> J[Find Ready Tasks]
        J --> K[Execute Ready Tasks]
        K --> L[Update Task Results]
        L --> I
    end
    
    I -- Yes --> M[Synthesis]
    M --> N[Generate Final Report]
    N --> O[Display Results to User]
    
    %% Task Execution Details
    J --> T1[Analysis Tasks]
    J --> T2[Context Tasks]
    J --> T3[Diagnosis Tasks]
    J --> T4[Recommendation Tasks]
    J --> T5[Custom Tasks]
    
    T1 --> L
    T2 --> L
    T3 --> L
    T4 --> L
    T5 --> L
    
    %% RAG Component
    R1[Playwright Docs] --> |Vector Embeddings| R2[Vector Store]
    R2 --> T2
    
    %% Error Handling & Retry Logic
    K -- Error --> RE[Retry Logic]
    RE -- Retry Attempts Remain --> K
    RE -- Max Retries Exceeded --> ER[Error Handler]
    ER --> O
    
    style A fill:#f9d5e5,stroke:#333
    style O fill:#eeeeee,stroke:#333
    style E fill:#bbdefb,stroke:#333
    style T1 fill:#d3f8e2,stroke:#333
    style T2 fill:#e3f2fd,stroke:#333
    style T3 fill:#fff9c4,stroke:#333
    style T4 fill:#ffccbc,stroke:#333
    style T5 fill:#e1bee7,stroke:#333
    style R1 fill:#e8eaf6,stroke:#333
    style R2 fill:#e8eaf6,stroke:#333
    style M fill:#dcedc8,stroke:#333
```

The orchestrated workflow offers several advantages:
1. **Dynamic Planning**: The OrchestratorAgent creates an execution plan based on the specific trace file
2. **Dependency Management**: Tasks specify which other tasks they depend on
3. **Flexible Execution**: Uses topological sorting to execute tasks in the correct order
4. **Potential Parallelism**: Independent tasks can execute simultaneously
5. **Robust Error Handling**: Includes retry mechanisms with exponential backoff
6. **Synthesis**: Explicit final step to combine insights from all analysis tasks

### Key Components

Both workflows integrate these essential components:

1. **Trace Processing**: Extracts structured data from Playwright trace files
2. **RAG (Retrieval Augmented Generation)**: Enhances AI responses with relevant Playwright documentation
3. **Interactive Chat**: Maintains conversation history and provides contextual responses

## Documentation Management

The tool uses a documentation directory located at `data/docs/` to store Playwright documentation for the RAG functionality:

- Documentation is automatically fetched from the Playwright GitHub repository
- Additional curated documentation for common failure scenarios is also included
- If the documentation directory doesn't exist, placeholder documentation is created automatically

### Managing Documentation

```bash
# Fetch documentation from Playwright GitHub repo
npm run fetch-docs

# Create enhanced documentation for common failure scenarios
npm run enhance-docs

# Do both operations (fetch and enhance)
npm run update-docs

# Force update documentation during analysis
npm run dev -- analyze path/to/onboarding-trace.zip --update-docs
```

### Disabling RAG

If you prefer to run the tool without using documentation retrieval:

```bash
# Disable RAG for standard analysis
npm run dev -- analyze path/to/onboarding-trace.zip --no-rag

# Disable RAG for orchestrated analysis
npm run dev -- analyze-orchestrated path/to/onboarding-trace.zip --no-rag
```

By default, RAG is enabled (`--rag` is set to true). When you use the `--no-rag` flag, the tool will not initialize the documentation provider, and AI responses will be based solely on the trace data without additional documentation context.


### Future Considerations for Production-readiness

- For Production we can support multiple models like OpenAI’s, Google’s Gemini model but we need to have OpenAIModelProvider its just a few lines of codes. 

- If one provider fails we can try with other one because sometimes apis are down from those providers. 

- We can add streaming for better UX during long generations, so that user does not wait for the end of the llm completion. 

- We can add mechanisms to evaluate our approaches & models. (Realtime eval + dataset based eval)

- Track token usage and associated costs. (Langchain already provides it, we can make use of it I believe.)

- In order for our approaches to be scalable, we can have a queue based architecture for handling many requests. 

- Instead of fetching the playwright docs from GitHub playwright md files, we can have a scraper written in playwright test, which crawls the playwright documentation webpage. Also we can deploy this playwright test to checkly so that it will periodically update the RAG docs.

- We can implement a re-usable prompt templates and we can use based on the agent we want, it could be something like enum or a constant.

- We can implement fully Autonomous Autofix Agent (requires test.spec.ts file).

- We can implement Observability with metrics, logging, and tracing. 

- We can add Alert system for failures or anomalies. 

- We can support visual analysis of screenshots from traces.

- This is a full CLI app, we can create backend api + frontend for this. 


#### Comparing the current AI Analysis Agent on Checkly versus my Orchestrator-Worker Workflow

- One of my tests fails due to it redirects to Cloudflare Gateway time-out page, when I run AI Analysis Agent on Checkly website, it does not give the reason of the error (its related to third party API issue.) However, Orchestrator-worker workflow I have finds this cause correctly. 

<img width="1024" alt="Screenshot 2025-05-11 at 23 07 26" src="https://github.com/user-attachments/assets/da7cd424-ddf1-43b2-a445-43daf300dedb" />

<img width="1402" alt="Screenshot 2025-05-11 at 23 10 13" src="https://github.com/user-attachments/assets/d335dd12-444e-49a9-a7dd-77ace663f023" />




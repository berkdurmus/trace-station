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
   (Since this is a private repo I'm giving my Anthropic api key and openai api key here.)
   ```
   ANTHROPIC_API_KEY = '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'
   OPENAI_API_KEY = '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'
   ```


2. Pass as a command line parameter:
   ```bash
   npm run dev -- analyze path/to/gateway-trace.zip
   ```

### Analyzing a Trace File

```bash
# Basic analysis
npm run dev -- analyze path/to/your/onboarding-trace.zip

# Force update documentation during analysis
npm run dev -- analyze path/to/your/onboarding-trace.zip --update-docs

# Disable RAG functionality (don't use documentation)
npm run dev -- analyze path/to/your/onboarding-trace.zip --no-rag
```

### Interactive Chat

For a simple interactive chat with the trace analysis assistant, use the `chat` command:

```bash
# Start a basic chat session
npm run dev -- chat path/to/your/event-trace.zip

# Force update documentation during chat
npm run dev -- chat path/to/your/event-trace.zip --update-docs

# Save chat transcript to file
npm run dev -- chat path/to/your/event-trace.zip -o chat-transcript.json
```

During the chat session:
- Type your questions about the test failure
- The assistant will respond with contextual answers based on the trace analysis
- Type 'exit' or 'quit' to end the chat session

### Using the Orchestrated Workflow

The orchestrated workflow provides more flexibility and control over the analysis process. It uses a workflow orchestrator that allows for conditional execution, retries, and potential parallelization of certain steps.

```bash
# Basic orchestrated analysis
npm run dev -- analyze-orchestrated path/to/your/onboarding-trace.zip

# With retries enabled (3 retries with exponential backoff)
npm run dev -- analyze-orchestrated path/to/your/onboarding-trace.zip -r

# Force update documentation during orchestrated analysis
npm run dev -- analyze-orchestrated path/to/your/onboarding-trace.zip --update-docs

# Disable RAG functionality (don't use documentation)
npm run dev -- analyze-orchestrated path/to/your/onboarding-trace.zip --no-rag

# With all options enabled
npm run dev -- analyze-orchestrated path/to/your/onboarding-trace.zip -r -c -p -v
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
npm run dev -- chat-orchestrated path/to/your/event-trace.zip

# With workflow options
npm run dev -- chat-orchestrated path/to/your/event-trace.zip -r -c -p

# Force update documentation during chat
npm run dev -- chat-orchestrated path/to/your/event-trace.zip --update-docs

# Save chat transcript to file
npm run dev -- chat-orchestrated path/to/your/event-trace.zip -o chat-transcript.json
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

1. **Trace Loading**: Loads and parses Playwright trace files (.trace or .zip)
2. **Analysis Pipeline**: Runs a series of specialized AI agents to analyze different aspects of the failure
3. **Documentation Retrieval**: Finds relevant documentation for the specific error context using RAG
4. **Interactive Chat**: Maintains conversation history and provides contextual responses

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
npm run dev -- analyze path/to/your/onboarding-trace.zip --update-docs
```

### Disabling RAG

If you prefer to run the tool without using documentation retrieval:

```bash
# Disable RAG for standard analysis
npm run dev -- analyze path/to/your/onboarding-trace.zip --no-rag

# Disable RAG for orchestrated analysis
npm run dev -- analyze-orchestrated path/to/your/onboarding-trace.zip --no-rag
```

By default, RAG is enabled (`--rag` is set to true). When you use the `--no-rag` flag, the tool will not initialize the documentation provider, and AI responses will be based solely on the trace data without additional documentation context.
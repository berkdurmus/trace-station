# Playwright Debug Agent

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

# Update documentation sources
npm run update-docs
```

## Usage

### API Keys

The tool uses AI models that require API keys. You can provide them in several ways:

1. Set environment variables directly when running commands:
   ```bash
   ANTHROPIC_API_KEY=your-key-here npm run dev -- analyze path/to/trace.zip
   ```

2. Use a .env file in the project root:
   ```
   ANTHROPIC_API_KEY=your-key-here
   OPENAI_API_KEY=your-openai-key-here
   ```

3. Pass as a command line parameter:
   ```bash
   npm run dev -- analyze path/to/trace.zip -k your-api-key
   ```

### Analyzing a Trace File

```bash
# Basic analysis
npm run dev -- analyze path/to/your/trace.zip

# With your Anthropic API key
npm run dev -- analyze path/to/your/trace.zip -k your-api-key

# With verbose documentation processing logs
npm run dev -- analyze path/to/your/trace.zip -v

# Force update documentation during analysis
npm run dev -- analyze path/to/your/trace.zip --update-docs

# Disable RAG functionality (don't use documentation)
npm run dev -- analyze path/to/your/trace.zip --no-rag

# Using environment variables
ANTHROPIC_API_KEY=your-key-here npm run dev -- analyze path/to/your/trace.zip -v
```

### Interactive Chat

For a simple interactive chat with the trace analysis assistant, use the `chat` command:

```bash
# Start a basic chat session
npm run dev -- chat path/to/your/trace.zip

# With your Anthropic API key
npm run dev -- chat path/to/your/trace.zip -k your-api-key

# With verbose processing logs
npm run dev -- chat path/to/your/trace.zip -v

# Force update documentation during chat
npm run dev -- chat path/to/your/trace.zip --update-docs

# Save chat transcript to file
npm run dev -- chat path/to/your/trace.zip -o chat-transcript.json
```

During the chat session:
- Type your questions about the test failure
- The assistant will respond with contextual answers based on the trace analysis
- Type 'exit' or 'quit' to end the chat session

### Using the Orchestrated Workflow

The orchestrated workflow provides more flexibility and control over the analysis process. It uses a workflow orchestrator that allows for conditional execution, retries, and potential parallelization of certain steps.

```bash
# Basic orchestrated analysis
npm run dev -- analyze-orchestrated path/to/your/trace.zip

# With retries enabled (3 retries with exponential backoff)
npm run dev -- analyze-orchestrated path/to/your/trace.zip -r

# With conditional context gathering (skips context step for low severity issues)
npm run dev -- analyze-orchestrated path/to/your/trace.zip -c

# Force update documentation during orchestrated analysis
npm run dev -- analyze-orchestrated path/to/your/trace.zip --update-docs

# Disable RAG functionality (don't use documentation)
npm run dev -- analyze-orchestrated path/to/your/trace.zip --no-rag

# With all options enabled
npm run dev -- analyze-orchestrated path/to/your/trace.zip -r -c -p -v

# Using environment variables
ANTHROPIC_API_KEY=your-key-here npm run dev -- analyze-orchestrated path/to/your/trace.zip -r -c -p
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
npm run dev -- chat-orchestrated path/to/your/trace.zip

# With workflow options
npm run dev -- chat-orchestrated path/to/your/trace.zip -r -c -p

# With your Anthropic API key
npm run dev -- chat-orchestrated path/to/your/trace.zip -k your-api-key

# Force update documentation during chat
npm run dev -- chat-orchestrated path/to/your/trace.zip --update-docs

# Save chat transcript to file
npm run dev -- chat-orchestrated path/to/your/trace.zip -o chat-transcript.json
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
npm run dev -- analyze path/to/your/trace.zip --update-docs
```

### Disabling RAG

If you prefer to run the tool without using documentation retrieval:

```bash
# Disable RAG for standard analysis
npm run dev -- analyze path/to/your/trace.zip --no-rag

# Disable RAG for orchestrated analysis
npm run dev -- analyze-orchestrated path/to/your/trace.zip --no-rag
```

By default, RAG is enabled (`--rag` is set to true). When you use the `--no-rag` flag, the tool will not initialize the documentation provider, and AI responses will be based solely on the trace data without additional documentation context.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
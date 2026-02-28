# Ruflo Memory and Intelligence

This project uses Ruflo for persistent vector memory and self-learning.

## Before Every Task

1. Search memory first: `memory_search(query="<description of what you need>")`
2. If score > 0.7, use the returned pattern directly
3. If score 0.5-0.7, adapt the pattern to fit
4. If no results or score < 0.5, proceed normally

## After Completing a Task

1. Store the successful pattern: `memory_store(key="<descriptive-key>", value="<what worked and why>", namespace="patterns")`
2. This builds the knowledge base so future tasks benefit

## For Complex Tasks

1. Initialize coordination: `swarm_init(topology="hierarchical", maxAgents=4, strategy="specialized")`
2. Spawn agents as needed: `agent_spawn(role="coder")`, `agent_spawn(role="tester")`
3. Let the router handle model selection automatically

## Available Tools (Key Ones)

- `memory_search` -- semantic search across all stored patterns
- `memory_store` -- save a pattern for future reuse
- `ruvector_search` -- vector similarity search
- `neural_train` -- train on accumulated patterns (run periodically)
- `neural_patterns` -- view learned patterns
- `swarm_init` -- set up multi-agent coordination
- `agent_spawn` -- create a specialized agent

## Token Efficiency

The memory system reduces token usage by retrieving compact context instead of reading entire files. Always search before reading.

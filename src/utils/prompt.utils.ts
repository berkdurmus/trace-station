/**
 * Utility functions for optimizing and compressing prompts
 */

/**
 * Compresses a text by removing unnecessary whitespace and optimizing formatting
 * @param text The text to compress
 * @returns Compressed text
 */
export function compressText(text: string): string {
  if (!text) return text;

  // Remove excessive whitespace
  return text
    .trim()
    .replace(/\n{3,}/g, "\n\n") // Replace 3+ newlines with 2
    .replace(/[ \t]+\n/g, "\n") // Remove trailing spaces on lines
    .replace(/\n[ \t]+/g, "\n") // Remove leading spaces on lines
    .replace(/[ \t]{2,}/g, " "); // Replace multiple spaces with one
}

/**
 * Truncates a text by keeping only the most important parts
 * For example, in stack traces, keep only the first N and last M lines
 * @param text The text to truncate
 * @param maxLength The maximum length of the truncated text
 * @param keepStartCount Number of lines to keep from the start
 * @param keepEndCount Number of lines to keep from the end
 * @returns Truncated text
 */
export function truncateText(
  text: string,
  maxLength: number = 500,
  keepStartCount: number = 3,
  keepEndCount: number = 2
): string {
  if (!text || text.length <= maxLength) return text;

  const lines = text.split("\n");

  // If we have fewer lines than our keep counts, just return the text
  if (lines.length <= keepStartCount + keepEndCount) {
    return text;
  }

  // Keep the beginning and end lines
  const startLines = lines.slice(0, keepStartCount);
  const endLines = lines.slice(-keepEndCount);

  // Create truncated text
  return [
    ...startLines,
    `... (${lines.length - keepStartCount - keepEndCount} lines omitted) ...`,
    ...endLines,
  ].join("\n");
}

/**
 * Optimize a prompt by compressing and truncating sections
 * @param sections Map of section names to their content
 * @param maxSectionLength Maximum length for each section
 * @returns Optimized prompt as a string
 */
export function optimizePrompt(
  sections: Record<string, string>,
  maxSectionLength: number = 1000
): string {
  const compressedSections: Record<string, string> = {};

  // Compress and truncate each section
  for (const [key, content] of Object.entries(sections)) {
    if (!content || content.trim() === "") continue;

    // Different truncation based on content type
    if (key === "Stack" || key.includes("Stack")) {
      compressedSections[key] = truncateText(
        compressText(content),
        maxSectionLength,
        3,
        3
      );
    } else if (key.includes("Timeline") || key.includes("Actions")) {
      // For action timelines, prioritize failures
      const lines = content.split("\n");
      const failedActions = lines.filter((line) => line.includes("FAILED"));
      const passedActions = lines.filter((line) => !line.includes("FAILED"));

      // Always include failed actions, then truncate passed actions if needed
      if (failedActions.length > 0) {
        // Keep a few successful actions before the failed ones for context
        const totalLength = [...failedActions, ...passedActions].join(
          "\n"
        ).length;
        if (totalLength > maxSectionLength) {
          // Keep all failures and a few passed actions
          const truncatedPassed = truncateText(
            passedActions.join("\n"),
            maxSectionLength - failedActions.join("\n").length,
            3,
            2
          );
          compressedSections[key] = `${truncatedPassed}\n${failedActions.join(
            "\n"
          )}`;
        } else {
          compressedSections[key] = [...failedActions, ...passedActions].join(
            "\n"
          );
        }
      } else {
        compressedSections[key] = truncateText(
          compressText(content),
          maxSectionLength
        );
      }
    } else if (key.includes("Network")) {
      // Prioritize failed network requests (status 4xx, 5xx)
      const lines = content.split("\n");
      const failedRequests = lines.filter((line) =>
        /4\d\d|5\d\d|error|failed/i.test(line)
      );
      const otherRequests = lines.filter(
        (line) => !/4\d\d|5\d\d|error|failed/i.test(line)
      );

      if (failedRequests.length > 0) {
        compressedSections[key] = [
          ...failedRequests,
          truncateText(
            otherRequests.join("\n"),
            maxSectionLength - failedRequests.join("\n").length,
            2,
            2
          ).split("\n"),
        ]
          .flat()
          .join("\n");
      } else {
        compressedSections[key] = truncateText(
          compressText(content),
          maxSectionLength
        );
      }
    } else {
      compressedSections[key] = truncateText(
        compressText(content),
        maxSectionLength
      );
    }
  }

  // Build the optimized prompt
  return Object.entries(compressedSections)
    .map(([key, content]) => `${key}:\n${content}`)
    .join("\n\n");
}

/**
 * Optimize a system prompt to be more concise
 * @param prompt The system prompt to optimize
 * @returns Optimized system prompt
 */
export function optimizeSystemPrompt(prompt: string): string {
  return (
    compressText(prompt)
      // Replace common verbose phrases with more concise ones
      .replace(/you are an expert at/i, "Expert at")
      .replace(/your task is to/i, "Task:")
      .replace(/focus on:/i, "Focus:")
      .replace(/should be/i, "Be")
  );
}

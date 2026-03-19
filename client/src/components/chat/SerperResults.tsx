import type { SerperUITool } from "@chat-app/shared";
import { ExternalLinkIcon, GlobeIcon, SearchIcon } from "lucide-react";

interface SerperResultsProps {
  data: SerperUITool["output"];
}

export function SerperResults({ data }: Readonly<SerperResultsProps>) {
  const {
    answerBox,
    knowledgeGraph,
    organic = [],
    peopleAlsoAsk = [],
    relatedSearches = [],
    searchParameters,
    totalResults,
  } = data;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="flex items-center gap-3 pb-3 border-b border-blue-200 dark:border-blue-800">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
          <SearchIcon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <div className="font-medium text-blue-900 dark:text-blue-100">Search Results</div>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            "{searchParameters?.q}" • {totalResults?.toLocaleString() || 0} results
          </div>
        </div>
      </div>

      {(answerBox?.answer || answerBox?.snippet || knowledgeGraph?.description) && (
        <div className="space-y-3 rounded-lg border border-blue-100 bg-white p-4 dark:border-blue-800/50 dark:bg-gray-900/50">
          {answerBox?.title && (
            <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">{answerBox.title}</div>
          )}
          {answerBox?.answer && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{answerBox.answer}</p>
          )}
          {!answerBox?.answer && answerBox?.snippet && (
            <p className="text-sm text-gray-700 dark:text-gray-300">{answerBox.snippet}</p>
          )}
          {knowledgeGraph?.title && (
            <div className="text-xs text-blue-700 dark:text-blue-300">
              {knowledgeGraph.title}
              {knowledgeGraph.type ? ` • ${knowledgeGraph.type}` : ""}
            </div>
          )}
          {knowledgeGraph?.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{knowledgeGraph.description}</p>
          )}
        </div>
      )}

      {organic.length > 0 && (
        <div className="space-y-4">
          {organic.slice(0, 4).map((result) => (
            <div
              key={result.position}
              className="bg-white dark:bg-gray-900/50 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 hover:shadow-md transition-shadow"
            >
              <a href={result.link} target="_blank" rel="noopener noreferrer" className="group block space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-blue-700 dark:text-blue-300 group-hover:text-blue-800 dark:group-hover:text-blue-200 line-clamp-2 leading-snug">
                    {result.title}
                  </h3>
                  <ExternalLinkIcon className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
                  {result.snippet}
                </p>
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <GlobeIcon className="w-3 h-3" />
                  {new URL(result.link).hostname}
                </div>
              </a>
            </div>
          ))}
        </div>
      )}

      {peopleAlsoAsk.length > 0 && (
        <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">People also ask</h4>
          <div className="space-y-2">
            {peopleAlsoAsk.slice(0, 3).map((item) => (
              <div
                key={item.question}
                className="rounded-lg border border-blue-100 bg-white/80 p-3 text-sm dark:border-blue-800/50 dark:bg-gray-900/40"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">{item.question}</div>
                {item.snippet && <div className="mt-1 text-gray-600 dark:text-gray-300">{item.snippet}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedSearches.length > 0 && (
        <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">Related searches</h4>
          <div className="flex flex-wrap gap-2">
            {relatedSearches.slice(0, 6).map((search) => (
              <span
                key={search.query}
                className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-700"
              >
                {search.query}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

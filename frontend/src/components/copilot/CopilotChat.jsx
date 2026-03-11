import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage, startStreaming, fetchSuggestions } from '../../store/copilotSlice';
import CopilotMessage from './CopilotMessage';
import CopilotReasoningSteps from './CopilotReasoningSteps';
import styles from './CopilotPanel.module.css';

/* ── Sparkle icon for empty state ────────────────────────── */

const IconSparkle = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  </svg>
);

const IconArrowRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/* ── CopilotChat ─────────────────────────────────────────── */

function CopilotChat() {
  const dispatch = useDispatch();
  const messages = useSelector((s) => s.copilot.messages);
  const isStreaming = useSelector((s) => s.copilot.isStreaming);
  const isLoading = useSelector((s) => s.copilot.isLoading);
  const streamingMessage = useSelector((s) => s.copilot.streamingMessage);
  const suggestions = useSelector((s) => s.copilot.suggestions);
  const scopeIds = useSelector((s) => s.copilot.scopeIds);
  const chatEndRef = useRef(null);

  // Fetch suggestions when scope changes
  useEffect(() => {
    if (scopeIds?.length > 0) {
      dispatch(fetchSuggestions(scopeIds[0]));
    }
  }, [scopeIds, dispatch]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSuggestionClick = (text) => {
    dispatch(startStreaming());
    dispatch(sendMessage({ message: text }));
  };

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className={styles.chatArea}>
      {isEmpty ? (
        /* ── Empty state ────────────────────────────────── */
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <IconSparkle />
          </div>
          <h2 className={styles.emptyTitle}>DocRack Copilot</h2>
          <p className={styles.emptySubtitle}>
            Ask anything about your documents.
          </p>

          {/* Suggested questions */}
          <div className={styles.suggestions}>
            {(suggestions.length > 0
              ? suggestions.slice(0, 4)
              : [
                  'Summarize the key points across all documents',
                  'What are the main financial figures mentioned?',
                  'List all entities and people referenced',
                  'Are there any missing or incomplete documents?',
                ]
            ).map((q, idx) => (
              <button
                key={idx}
                className={styles.suggestionChip}
                onClick={() => handleSuggestionClick(q)}
              >
                <IconArrowRight />
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Messages list ──────────────────────────────── */
        <>
          {messages.map((msg, idx) => (
            <CopilotMessage key={idx} message={msg} />
          ))}

          {/* Reasoning steps — shown while loading before stream starts */}
          {isLoading && !streamingMessage && <CopilotReasoningSteps />}

          {/* Streaming message */}
          {isStreaming && streamingMessage && (
            <div className={`${styles.messageRow} ${styles.messageRowAssistant}`}>
              <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingMessage}
                </ReactMarkdown>
                <span className={styles.streamCursor} />
              </div>
            </div>
          )}
        </>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}

export default CopilotChat;

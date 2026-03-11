import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopilotSources from './CopilotSources';
import styles from './CopilotPanel.module.css';

/* ── Copy icon ───────────────────────────────────────────── */

const IconCopy = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── CopilotMessage ──────────────────────────────────────── */

function CopilotMessage({ message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may not be available
    }
  }, [message.content]);

  const isUser = message.role === 'user';

  return (
    <div className={`${styles.messageRow} ${isUser ? styles.messageRowUser : styles.messageRowAssistant}`}>
      <div className={`${styles.messageBubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        )}

        {/* Copy button — shows on hover */}
        <button
          className={styles.copyBtn}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy message'}
          aria-label="Copy message"
        >
          {copied ? <IconCheck /> : <IconCopy />}
        </button>
      </div>

      {/* Source citations for assistant messages */}
      {!isUser && message.sources && message.sources.length > 0 && (
        <CopilotSources sources={message.sources} />
      )}
    </div>
  );
}

export default CopilotMessage;

import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchReceived, fetchMyShares } from '../store/sharingSlice';
import {
  fetchCollaborations,
  requestCollaboration,
  acceptCollaboration,
  rejectCollaboration,
  removeCollaboration,
  clearCollaborationError,
} from '../store/collaborationSlice';
import SharedWithMe from '../components/sharing/SharedWithMe';
import MyShares from '../components/sharing/MyShares';
import styles from './CollaborationPage.module.css';

const initials = (name, email) => {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return source[0].toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

function CollaborationPage() {
  const dispatch = useDispatch();
  const { received, myShares, isLoading: sharingLoading } = useSelector(state => state.sharing);
  const {
    accepted,
    incoming,
    outgoing,
    isRequesting,
    isLoading: collabLoading,
    error: collabError,
  } = useSelector(state => state.collaboration);

  const [activeTab, setActiveTab] = useState('people');
  const [showAddModal, setShowAddModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    dispatch(fetchCollaborations());
    dispatch(fetchReceived());
    dispatch(fetchMyShares());
  }, [dispatch]);

  useEffect(() => {
    if (collabError) {
      setFeedback({ type: 'error', text: collabError });
    }
  }, [collabError]);

  const closeAddModal = () => {
    setShowAddModal(false);
    setInviteEmail('');
    setFeedback(null);
    dispatch(clearCollaborationError());
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFeedback({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    const result = await dispatch(requestCollaboration(email));
    if (requestCollaboration.fulfilled.match(result)) {
      const payload = result.payload || {};
      if (payload.invite?.pendingSignup) {
        setFeedback({ type: 'success', text: 'Invite email sent. They can join when they sign up.' });
      } else {
        setFeedback({ type: 'success', text: 'Request sent.' });
      }
      setInviteEmail('');
    }
  };

  const peopleCount = accepted.length;
  const incomingCount = incoming.length;
  const outgoingCount = outgoing.length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h1 className={styles.title}>Collaboration</h1>
            <p className={styles.subtitle}>People you work with and DataRooms shared between you</p>
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ flex: 'none', padding: '8px 16px', fontSize: '13px' }}
            onClick={() => setShowAddModal(true)}
          >
            + Add collaborator
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'people' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('people')}
        >
          People
          {peopleCount > 0 && <span className={styles.badge}>{peopleCount}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'requests' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests
          {incomingCount > 0 && <span className={styles.badge}>{incomingCount}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'sent' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          Sent
          {outgoingCount > 0 && <span className={styles.badge}>{outgoingCount}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'received' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('received')}
        >
          Shared with me
          {received.length > 0 && <span className={styles.badge}>{received.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'shared' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          My shares
          {myShares.length > 0 && <span className={styles.badge}>{myShares.length}</span>}
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'people' && (
          <PeopleList
            items={accepted}
            isLoading={collabLoading}
            onRemove={(id) => dispatch(removeCollaboration(id))}
          />
        )}
        {activeTab === 'requests' && (
          <IncomingList
            items={incoming}
            isLoading={collabLoading}
            onAccept={(id) => dispatch(acceptCollaboration(id))}
            onReject={(id) => dispatch(rejectCollaboration(id))}
          />
        )}
        {activeTab === 'sent' && (
          <OutgoingList
            items={outgoing}
            isLoading={collabLoading}
            onCancel={(id) => dispatch(removeCollaboration(id))}
          />
        )}
        {activeTab === 'received' && <SharedWithMe items={received} isLoading={sharingLoading} />}
        {activeTab === 'shared' && <MyShares items={myShares} isLoading={sharingLoading} />}
      </div>

      {showAddModal && (
        <div className={styles.modalBackdrop} onClick={closeAddModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Add collaborator</h2>
            <p className={styles.modalSubtitle}>
              Enter the email of the person you want to collaborate with. If they're not on Orvyn yet, we'll invite them.
            </p>
            <form onSubmit={handleSendRequest}>
              <input
                type="email"
                className={styles.searchInput}
                placeholder="name@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setFeedback(null); }}
                autoFocus
                disabled={isRequesting}
              />
              {feedback && (
                <p
                  className={styles.cardMeta}
                  style={{
                    marginTop: 10,
                    color: feedback.type === 'error' ? 'var(--danger-color)' : 'var(--accent-primary)',
                  }}
                >
                  {feedback.text}
                </p>
              )}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={closeAddModal}
                  disabled={isRequesting}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ flex: 'none', padding: '8px 18px', fontSize: '13px' }}
                  disabled={isRequesting || !inviteEmail.trim()}
                >
                  {isRequesting ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-lists ──────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className={styles.loadingWrap}>
      <div className={styles.loadingDots}>
        <div className={styles.loadingDot} />
        <div className={styles.loadingDot} />
        <div className={styles.loadingDot} />
      </div>
    </div>
  );
}

function EmptyState({ title, hint }) {
  return (
    <div className={styles.emptyState}>
      <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
      </svg>
      <div className={styles.emptyTitle}>{title}</div>
      {hint && <div className={styles.emptyHint}>{hint}</div>}
    </div>
  );
}

function UserCard({ person, actions, badge }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>{initials(person.name, person.email)}</div>
        <div className={styles.cardInfo}>
          <p className={styles.cardName}>{person.name || person.email}</p>
          <div className={styles.cardMeta}>
            <span>{person.email}</span>
            {badge && <span className={styles.orgBadge}>{badge}</span>}
          </div>
        </div>
      </div>
      {actions && <div className={styles.cardActions}>{actions}</div>}
    </div>
  );
}

function PeopleList({ items, isLoading, onRemove }) {
  if (isLoading && items.length === 0) return <LoadingDots />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="No collaborators yet"
        hint="Add people by email to share DataRooms with them. Org teammates appear here automatically."
      />
    );
  }
  return (
    <div className={styles.cardGrid}>
      {items.map((c) => {
        const person = c.user || {};
        return (
          <UserCard
            key={c.id || `${person._id}-${c.source}`}
            person={person}
            badge={c.source === 'org' ? 'Organization' : null}
            actions={c.source === 'org' ? null : (
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => onRemove(c.id)}
              >
                Remove
              </button>
            )}
          />
        );
      })}
    </div>
  );
}

function IncomingList({ items, isLoading, onAccept, onReject }) {
  if (isLoading && items.length === 0) return <LoadingDots />;
  if (items.length === 0) {
    return <EmptyState title="No pending requests" hint="Incoming collaboration requests will appear here." />;
  }
  return (
    <div className={styles.cardGrid}>
      {items.map((c) => (
        <UserCard
          key={c.id}
          person={c.user || {}}
          actions={
            <>
              <button className={styles.btnPrimary} onClick={() => onAccept(c.id)}>Accept</button>
              <button className={styles.btnOutline} onClick={() => onReject(c.id)}>Decline</button>
            </>
          }
        />
      ))}
    </div>
  );
}

function OutgoingList({ items, isLoading, onCancel }) {
  if (isLoading && items.length === 0) return <LoadingDots />;
  if (items.length === 0) {
    return <EmptyState title="No sent requests" hint="Requests you send will appear here until accepted." />;
  }
  return (
    <div className={styles.cardGrid}>
      {items.map((c) => (
        <UserCard
          key={c.id}
          person={c.user || {}}
          badge="Pending"
          actions={
            <button className={styles.btnDanger} onClick={() => onCancel(c.id)}>
              Cancel
            </button>
          }
        />
      ))}
    </div>
  );
}

export default CollaborationPage;

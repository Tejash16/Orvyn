import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchReceived, fetchMyShares } from '../store/sharingSlice';
import SharedWithMe from '../components/sharing/SharedWithMe';
import MyShares from '../components/sharing/MyShares';
import styles from './CollaborationPage.module.css';

function CollaborationPage() {
  const dispatch = useDispatch();
  const { received, myShares, isLoading } = useSelector(state => state.sharing);
  const [activeTab, setActiveTab] = useState('received');

  useEffect(() => {
    dispatch(fetchReceived());
    dispatch(fetchMyShares());
  }, [dispatch]);

  return (
    <div className={styles.page}>
      {/* Header */}
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
          <div>
            <h1 className={styles.title}>Collaboration</h1>
            <p className={styles.subtitle}>DataRooms shared with you and by you</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
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

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'received' && <SharedWithMe items={received} isLoading={isLoading} />}
        {activeTab === 'shared' && <MyShares items={myShares} isLoading={isLoading} />}
      </div>
    </div>
  );
}

export default CollaborationPage;

import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchOrganization,
  fetchMembers,
  fetchInvites,
  createInviteThunk,
  removeMemberThunk,
  updateMemberRoleThunk,
  revokeInviteThunk,
  deleteOrganizationThunk,
  fetchAuditLogs,
  clearAuditLogs,
} from '../store/organizationSlice';
import { addToast, setActivePage } from '../store/uiSlice';
import styles from './OrganizationSettings.module.css';

// ── Human-readable action labels ─────────────────────────
const ACTION_LABELS = {
  'dataroom.shared':              'Shared DataRoom',
  'dataroom.share_revoked':       'Revoked Share Access',
  'dataroom.share_updated':       'Updated Share',
  'dataroom.accessed':            'Accessed Shared DataRoom',
  'dataroom.imported':            'Imported DataRoom',
  'org.member_invited':           'Invited Member',
  'org.member_joined':            'Member Joined',
  'org.member_removed':           'Removed Member',
  'org.member_role_changed':      'Changed Member Role',
  'org.settings_updated':         'Updated Settings',
  'billing.subscription_created': 'Created Subscription',
  'billing.payment_success':      'Payment Succeeded',
  'billing.payment_failed':       'Payment Failed',
  'billing.subscription_cancelled':'Cancelled Subscription',
  'billing.plan_downgraded':      'Plan Downgraded',
  'dataroom.created':             'Created DataRoom',
  'dataroom.deleted':             'Deleted DataRoom',
};

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'dataroom.shared', label: 'Shared DataRoom' },
  { value: 'dataroom.share_revoked', label: 'Revoked Share' },
  { value: 'dataroom.share_updated', label: 'Updated Share' },
  { value: 'dataroom.accessed', label: 'Accessed Share' },
  { value: 'dataroom.imported', label: 'Imported DataRoom' },
  { value: 'org.member_invited', label: 'Invited Member' },
  { value: 'org.member_joined', label: 'Member Joined' },
  { value: 'org.member_removed', label: 'Removed Member' },
  { value: 'org.member_role_changed', label: 'Role Changed' },
  { value: 'org.settings_updated', label: 'Settings Updated' },
  { value: 'billing.payment_success', label: 'Payment Success' },
  { value: 'billing.payment_failed', label: 'Payment Failed' },
  { value: 'billing.subscription_cancelled', label: 'Sub. Cancelled' },
];

// ── Action category for badge colors ─────────────────────
function getActionCategory(action) {
  if (action.startsWith('dataroom.')) return 'dataroom';
  if (action.startsWith('org.')) return 'org';
  if (action.startsWith('billing.')) return 'billing';
  return 'other';
}

// ── Relative time formatter ──────────────────────────────
function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function OrganizationSettings() {
  const dispatch = useDispatch();
  const user         = useSelector((s) => s.auth.user);
  const organization = useSelector((s) => s.organization.organization);
  const members      = useSelector((s) => s.organization.members);
  const invites      = useSelector((s) => s.organization.invites);
  const isLoading    = useSelector((s) => s.organization.isLoading);
  const auditLogs    = useSelector((s) => s.organization.auditLogs);
  const auditTotal   = useSelector((s) => s.organization.auditTotal);
  const auditPage    = useSelector((s) => s.organization.auditPage);
  const auditTotalPages = useSelector((s) => s.organization.auditTotalPages);
  const isAuditLoading  = useSelector((s) => s.organization.isAuditLoading);

  const [activeTab, setActiveTab] = useState('details');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('member');
  const [inviteSending, setInviteSending] = useState(false);
  const [lastInvite, setLastInvite]   = useState(null);   // { email, inviteUrl, inviteCode }
  const [copiedKey, setCopiedKey]     = useState(null);   // which value was just copied

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Audit log filters
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const orgId = user?.activeOrganizationId;

  // Determine current user's role in the org
  const currentMember = members.find(
    (m) => (m.userId?._id || m.userId) === user?._id,
  );
  const myRole = currentMember?.role || 'member';
  const isAdminOrOwner = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  useEffect(() => {
    if (orgId) {
      dispatch(fetchOrganization(orgId));
      dispatch(fetchMembers(orgId));
      if (isAdminOrOwner) {
        dispatch(fetchInvites(orgId));
      }
    }
  }, [dispatch, orgId, isAdminOrOwner]);

  // Fetch audit logs when tab is active
  const loadAuditLogs = useCallback((page = 1) => {
    if (!orgId || !isAdminOrOwner) return;
    const filters = { page, limit: 50 };
    if (auditActionFilter) filters.action = auditActionFilter;
    dispatch(fetchAuditLogs(orgId, filters));
  }, [dispatch, orgId, isAdminOrOwner, auditActionFilter]);

  useEffect(() => {
    if (activeTab === 'activity' && isAdminOrOwner && orgId) {
      loadAuditLogs(1);
    }
    return () => {
      if (activeTab !== 'activity') {
        dispatch(clearAuditLogs());
      }
    };
  }, [activeTab, loadAuditLogs, isAdminOrOwner, orgId, dispatch]);

  // Refresh when filter changes
  useEffect(() => {
    if (activeTab === 'activity') {
      loadAuditLogs(1);
    }
  }, [auditActionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;
    setInviteSending(true);
    const targetEmail = inviteEmail.trim();
    try {
      const result = await dispatch(createInviteThunk(orgId, targetEmail, inviteRole));
      if (result.success) {
        setInviteEmail('');
        setLastInvite({
          email: targetEmail,
          inviteUrl: result.invite?.inviteUrl || '',
          inviteCode: result.invite?.inviteCode || '',
        });
        dispatch(addToast({ message: `Invite sent to ${targetEmail}`, type: 'success' }));
      } else {
        dispatch(addToast({ message: result.error || 'Failed to send invite.', type: 'error' }));
      }
    } finally {
      setInviteSending(false);
    }
  }

  async function copyToClipboard(value, key) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      dispatch(addToast({ message: 'Failed to copy to clipboard.', type: 'error' }));
    }
  }

  async function handleRemoveMember(memberId, memberName) {
    const result = await dispatch(removeMemberThunk(orgId, memberId));
    if (result.success) {
      dispatch(addToast({ message: `${memberName} removed.`, type: 'success' }));
    } else {
      dispatch(addToast({ message: result.error || 'Failed to remove member.', type: 'error' }));
    }
  }

  async function handleRoleChange(memberId, newRole) {
    const result = await dispatch(updateMemberRoleThunk(orgId, memberId, newRole));
    if (!result.success) {
      dispatch(addToast({ message: result.error || 'Failed to update role.', type: 'error' }));
    }
  }

  async function handleRevokeInvite(inviteId) {
    const result = await dispatch(revokeInviteThunk(orgId, inviteId));
    if (result.success) {
      dispatch(addToast({ message: 'Invite revoked.', type: 'success' }));
    } else {
      dispatch(addToast({ message: result.error || 'Failed to revoke invite.', type: 'error' }));
    }
  }

  async function handleDeleteOrg() {
    setDeleteLoading(true);
    try {
      const result = await dispatch(deleteOrganizationThunk(orgId));
      if (result.success) {
        dispatch(addToast({ message: 'Organization deleted.', type: 'success' }));
        setShowDeleteModal(false);
      } else {
        dispatch(addToast({ message: result.error || 'Failed to delete.', type: 'error' }));
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!orgId) {
    return (
      <div className={styles.container}>
        <p className={styles.emptyText}>You are not part of any organization.</p>
      </div>
    );
  }

  if (isLoading && !organization) {
    return (
      <div className={styles.container}>
        <p className={styles.loadingText}>Loading organization...</p>
      </div>
    );
  }

  // Build tabs
  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'members', label: `Members (${members.length})` },
  ];
  if (isAdminOrOwner) {
    tabs.push({ id: 'invites', label: 'Invites' });
    tabs.push({ id: 'activity', label: 'Activity Log' });
  }
  if (isOwner) {
    tabs.push({ id: 'danger', label: 'Danger Zone' });
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => dispatch(setActivePage('settings'))}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Settings
      </button>
      <h1 className={styles.pageTitle}>Organization Settings</h1>

      {/* Tab navigation */}
      <div className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Details Tab ──────────────────────────────────── */}
      {activeTab === 'details' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Details</h2>
          <div className={styles.orgInfoRow}>
            <span className={styles.orgInfoLabel}>Name</span>
            <span className={styles.orgInfoValue}>{organization?.name || '—'}</span>
          </div>
          <div className={styles.orgInfoRow}>
            <span className={styles.orgInfoLabel}>Slug</span>
            <span className={styles.orgInfoValue}>{organization?.slug || '—'}</span>
          </div>
          <div className={styles.orgInfoRow}>
            <span className={styles.orgInfoLabel}>Plan</span>
            <span className={styles.orgInfoValue} style={{ textTransform: 'capitalize' }}>
              {organization?.plan || 'trial'}
            </span>
          </div>
          <div className={styles.orgInfoRow}>
            <span className={styles.orgInfoLabel}>Max seats</span>
            <span className={styles.orgInfoValue}>{organization?.maxSeats ?? 5}</span>
          </div>
        </div>
      )}

      {/* ── Members Tab ──────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Members ({members.length})
          </h2>
          {members.length === 0 ? (
            <p className={styles.emptyText}>No members yet.</p>
          ) : (
            <table className={styles.membersTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  {isAdminOrOwner && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const mUser = member.userId || {};
                  const mId = mUser._id || member.userId;
                  const mRole = member.role;
                  const isSelf = mId === user?._id;
                  const canEdit = isAdminOrOwner && mRole !== 'owner' && !isSelf;

                  return (
                    <tr key={member._id}>
                      <td>
                        <span className={styles.memberName}>{mUser.name || '—'}</span>
                      </td>
                      <td>
                        <span className={styles.memberEmail}>{mUser.email || '—'}</span>
                      </td>
                      <td>
                        <span className={styles.roleBadge} data-role={mRole}>{mRole}</span>
                      </td>
                      {isAdminOrOwner && (
                        <td>
                          {canEdit ? (
                            <div className={styles.actionsCell}>
                              <select
                                className={styles.roleSelect}
                                value={mRole}
                                onChange={(e) => handleRoleChange(mId, e.target.value)}
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button
                                className={styles.actionBtnDanger}
                                onClick={() => handleRemoveMember(mId, mUser.name || 'member')}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {isSelf ? 'You' : '—'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Invites Tab (admin/owner only) ────────────────── */}
      {activeTab === 'invites' && isAdminOrOwner && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Invite Members</h2>
          <form className={styles.inviteForm} onSubmit={handleSendInvite}>
            <input
              type="email"
              className={styles.inviteInput}
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviteSending}
            />
            <select
              className={styles.inviteRoleSelect}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={inviteSending}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className={styles.inviteBtn}
              disabled={!inviteEmail.trim() || inviteSending}
            >
              {inviteSending ? 'Sending...' : 'Send Invite'}
            </button>
          </form>

          {/* Freshly-created invite — link banner with Copy + Dismiss */}
          {lastInvite && (
            <div className={styles.inviteLinkBanner}>
              <div className={styles.inviteLinkBannerHead}>
                <div>
                  <span className={styles.inviteLinkBannerTitle}>Invite sent to {lastInvite.email}</span>
                  <span className={styles.inviteLinkBannerHint}>
                    Share this link with them directly, or they can use the email we just sent.
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.inviteLinkDismiss}
                  onClick={() => setLastInvite(null)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
              <div className={styles.inviteLinkRow}>
                <input
                  type="text"
                  readOnly
                  value={lastInvite.inviteUrl || lastInvite.inviteCode}
                  className={styles.inviteLinkInput}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={styles.inviteLinkCopyBtn}
                  onClick={() => copyToClipboard(lastInvite.inviteUrl, `fresh-link`)}
                >
                  {copiedKey === 'fresh-link' ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  type="button"
                  className={styles.inviteLinkCopyBtnSecondary}
                  onClick={() => copyToClipboard(lastInvite.inviteCode, `fresh-code`)}
                >
                  {copiedKey === 'fresh-code' ? 'Copied!' : 'Copy code'}
                </button>
              </div>
            </div>
          )}

          {/* Pending invites */}
          {invites.length > 0 && (
            <>
              <h3 className={styles.sectionTitle} style={{ fontSize: '0.875rem', marginTop: 8 }}>
                Pending Invites ({invites.length})
              </h3>
              <div className={styles.inviteList}>
                {invites.map((inv) => (
                  <div key={inv._id} className={styles.inviteRow}>
                    <div className={styles.inviteRowMain}>
                      <div className={styles.inviteRowHead}>
                        <span className={styles.inviteEmail}>{inv.email}</span>
                        <span className={styles.inviteRole}>{inv.role}</span>
                      </div>
                      {inv.inviteUrl && (
                        <span className={styles.inviteRowLink} title={inv.inviteUrl}>
                          {inv.inviteUrl}
                        </span>
                      )}
                    </div>
                    <div className={styles.inviteRowActions}>
                      {inv.inviteUrl && (
                        <button
                          className={styles.inviteLinkCopyBtnSecondary}
                          onClick={() => copyToClipboard(inv.inviteUrl, `row-${inv._id}`)}
                          type="button"
                        >
                          {copiedKey === `row-${inv._id}` ? 'Copied!' : 'Copy link'}
                        </button>
                      )}
                      <button
                        className={styles.actionBtnDanger}
                        onClick={() => handleRevokeInvite(inv._id)}
                        type="button"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Activity Log Tab (admin/owner only) ──────────── */}
      {activeTab === 'activity' && isAdminOrOwner && (
        <div className={styles.section}>
          <div className={styles.activityHeader}>
            <h2 className={styles.sectionTitle}>Activity Log</h2>
            <div className={styles.activityFilters}>
              <select
                className={styles.auditFilterSelect}
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                {ACTION_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isAuditLoading ? (
            <p className={styles.loadingText}>Loading activity...</p>
          ) : auditLogs.length === 0 ? (
            <p className={styles.emptyText}>No activity found.</p>
          ) : (
            <>
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log._id}>
                      <td>
                        <div className={styles.auditUser}>
                          <span className={styles.auditUserName}>{log.userName}</span>
                          <span className={styles.auditUserEmail}>{log.userEmail}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={styles.actionBadge}
                          data-category={getActionCategory(log.action)}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td>
                        <span className={styles.auditResource}>
                          {log.resourceName || log.resourceType}
                        </span>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <span className={styles.auditMeta}>
                            {formatMetadata(log.action, log.metadata)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={styles.auditTime} title={new Date(log.createdAt).toLocaleString()}>
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {auditTotalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.paginationBtn}
                    disabled={auditPage <= 1}
                    onClick={() => loadAuditLogs(auditPage - 1)}
                  >
                    ← Previous
                  </button>
                  <span className={styles.paginationInfo}>
                    Page {auditPage} of {auditTotalPages} ({auditTotal} events)
                  </span>
                  <button
                    className={styles.paginationBtn}
                    disabled={auditPage >= auditTotalPages}
                    onClick={() => loadAuditLogs(auditPage + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Danger Zone Tab (owner only) ─────────────────── */}
      {activeTab === 'danger' && isOwner && (
        <div className={styles.dangerSection}>
          <h2 className={styles.sectionTitle}>Danger Zone</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Deleting the organization will remove all members and revoke pending invites.
            This action cannot be undone.
          </p>
          <button
            className={styles.dangerBtn}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete Organization
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete Organization?</h3>
            <p className={styles.modalText}>
              This will permanently delete <strong>{organization?.name}</strong>, remove all
              members, and revoke all pending invites. This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancelBtn}
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className={styles.modalDeleteBtn}
                onClick={handleDeleteOrg}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format metadata into a concise human-readable string.
 */
function formatMetadata(action, metadata) {
  if (!metadata) return '';
  switch (action) {
    case 'dataroom.shared':
      return metadata.recipientEmail ? `→ ${metadata.recipientEmail}` : '';
    case 'dataroom.share_revoked':
      return metadata.revokedUserId ? `User removed` : '';
    case 'dataroom.share_updated':
      return metadata.snapshotVersion ? `v${metadata.snapshotVersion}` : '';
    case 'org.member_invited':
      return metadata.invitedEmail ? `${metadata.invitedEmail} as ${metadata.role}` : '';
    case 'org.member_removed':
      return '';
    case 'org.member_role_changed':
      return metadata.oldRole && metadata.newRole
        ? `${metadata.oldRole} → ${metadata.newRole}`
        : '';
    case 'billing.payment_success':
      return metadata.amount ? `₹${(metadata.amount / 100).toFixed(0)}` : '';
    case 'billing.payment_failed':
      return metadata.reason || '';
    default:
      return '';
  }
}

export default OrganizationSettings;

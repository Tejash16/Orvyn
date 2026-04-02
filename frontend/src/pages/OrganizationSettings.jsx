import { useState, useEffect } from 'react';
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
} from '../store/organizationSlice';
import { addToast } from '../store/uiSlice';
import styles from './OrganizationSettings.module.css';

function OrganizationSettings() {
  const dispatch = useDispatch();
  const user         = useSelector((s) => s.auth.user);
  const organization = useSelector((s) => s.organization.organization);
  const members      = useSelector((s) => s.organization.members);
  const invites      = useSelector((s) => s.organization.invites);
  const isLoading    = useSelector((s) => s.organization.isLoading);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('member');
  const [inviteSending, setInviteSending] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  async function handleSendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;
    setInviteSending(true);
    try {
      const result = await dispatch(createInviteThunk(orgId, inviteEmail.trim(), inviteRole));
      if (result.success) {
        setInviteEmail('');
        dispatch(addToast({ message: `Invite sent to ${inviteEmail.trim()}`, type: 'success' }));
      } else {
        dispatch(addToast({ message: result.error || 'Failed to send invite.', type: 'error' }));
      }
    } finally {
      setInviteSending(false);
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

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Organization Settings</h1>

      {/* Org info */}
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

      {/* Members */}
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

      {/* Invite form (admin/owner only) */}
      {isAdminOrOwner && (
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

          {/* Pending invites */}
          {invites.length > 0 && (
            <>
              <h3 className={styles.sectionTitle} style={{ fontSize: '0.875rem', marginTop: 8 }}>
                Pending Invites ({invites.length})
              </h3>
              <div className={styles.inviteList}>
                {invites.map((inv) => (
                  <div key={inv._id} className={styles.inviteRow}>
                    <div>
                      <span className={styles.inviteEmail}>{inv.email}</span>
                      <span className={styles.inviteRole}>{inv.role}</span>
                    </div>
                    <button
                      className={styles.actionBtnDanger}
                      onClick={() => handleRevokeInvite(inv._id)}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Danger zone (owner only) */}
      {isOwner && (
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

export default OrganizationSettings;

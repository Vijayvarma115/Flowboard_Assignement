import { useMemo } from 'react';

const ACTIVITY_BADGES = {
  TASK_CREATED: 'Created',
  TASK_UPDATED: 'Updated',
  TASK_DELETED: 'Deleted',
  TASK_COMMENTED: 'Comment',
  COMMENT_MENTIONED: 'Mention',
};

function initials(name = '?') {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(value) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function highlightMentions(text) {
  const parts = [];
  const regex = /(@[a-zA-Z0-9._-]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={`${match.index}-${match[0]}`} className="font-medium text-primary-600">
        {match[0]}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

export default function TaskCollaborationDrawer({
  task,
  projectMembers = [],
  comments = [],
  activity = [],
  commentDraft,
  setCommentDraft,
  onClose,
  onSubmitComment,
  isSubmitting,
}) {
  const mentionSuggestions = useMemo(() => {
    const match = commentDraft.match(/@([a-zA-Z0-9._-]*)$/);
    if (!match) return [];
    const query = match[1].toLowerCase();

    return projectMembers
      .map(member => member.user)
      .filter(Boolean)
      .filter(user => {
        const variants = [
          user.name,
          user.name.split(' ')[0],
          user.email,
          user.email.split('@')[0],
          user.name.split(' ').join(''),
        ]
          .filter(Boolean)
          .map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return variants.some(value => value.startsWith(query));
      })
      .slice(0, 5);
  }, [commentDraft, projectMembers]);

  function insertMention(user) {
    const display = `@${user.name.split(' ')[0]}`;
    setCommentDraft(prev => prev.replace(/@([a-zA-Z0-9._-]*)$/, `${display} `));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 px-0 sm:px-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full sm:max-w-5xl h-[88vh] sm:h-[84vh] bg-white sm:rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 via-white to-white">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400 mb-1">Task conversation</p>
            <h2 className="text-xl font-bold text-gray-900 truncate">{task.title}</h2>
            <p className="text-sm text-gray-500 mt-1 truncate">Use @ to mention teammates in comments</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            aria-label="Close task conversation"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-gray-50/70">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Team discussion and mentions</p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                  {comments.length} total
                </span>
              </div>

              <form onSubmit={onSubmitComment} className="space-y-3">
                <div className="relative">
                  <textarea
                    value={commentDraft}
                    onChange={e => setCommentDraft(e.target.value)}
                    placeholder="Write a comment... Type @ to mention someone"
                    rows={4}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 resize-none"
                  />
                  {mentionSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-10">
                      {mentionSuggestions.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => insertMention(user)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                            <span className="text-white text-[11px] font-semibold">{initials(user.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">@{user.email.split('@')[0]}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">Mentions are recognized from @name suggestions.</p>
                  <button
                    type="submit"
                    disabled={isSubmitting || !commentDraft.trim()}
                    className="px-4 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-60 transition-colors"
                  >
                    {isSubmitting ? 'Posting…' : 'Post comment'}
                  </button>
                </div>
              </form>

              <div className="mt-5 space-y-3">
                {comments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    No comments yet. Start the conversation.
                  </div>
                ) : (
                  comments.map(comment => (
                    <article key={comment.id} className="rounded-2xl border border-gray-200 p-4 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-[11px] font-semibold">{initials(comment.author?.name)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{comment.author?.name}</p>
                              <p className="text-[11px] text-gray-400">{formatTime(comment.createdAt)}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {highlightMentions(comment.content)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Task changes and comment history</p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  {activity.length} events
                </span>
              </div>

              <div className="space-y-3">
                {activity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    No activity yet.
                  </div>
                ) : (
                  activity.map(item => (
                    <div key={item.id} className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                          <span className="text-white text-[10px] font-semibold">{item.user?.name ? initials(item.user.name) : 'FB'}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white text-gray-600 border border-gray-200">
                              {ACTIVITY_BADGES[item.type] || 'Activity'}
                            </span>
                            <span className="text-[11px] text-gray-400">{formatTime(item.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

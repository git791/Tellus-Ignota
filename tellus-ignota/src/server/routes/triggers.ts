import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context, redis, reddit, scheduler } from '@devvit/web/server';
import { createPost } from '../core/post';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    await scheduler.runJob({
      name: 'daily-post-job',
      cron: '0 0 * * *'
    });

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

triggers.post('/on-comment-submit', async (c) => {
  try {
    const input = await c.req.json<any>();
    const authorId = input.author?.id;
    
    // We need the username, the event only has author.id, let's fetch user
    if (!authorId) return c.json({ status: 'ignored' }, 200);
    
    const user = await reddit.getUserById(authorId).catch(() => null);
    if (!user) return c.json({ status: 'ignored' }, 200);
    const username = user.username;

    // 1. Grant Bonus Action flag
    const today = new Date().toISOString().slice(0, 10);
    await redis.set(`bonusAction:${username}:${today}`, 'true');

    // 2. Scavenger Hunt (Claiming artifacts)
    const commentBody = input.comment?.body?.trim().toLowerCase() || '';
    if (commentBody === 'claim') {
      const parentId = input.comment?.parentId;
      if (parentId) {
        // Find if the parent comment is our bot's artifact clue
        const parentComment = await reddit.getCommentById(parentId).catch(() => null);
        const currentUser = await reddit.getCurrentUser().catch(() => null);
        if (parentComment && currentUser && parentComment.authorId === currentUser.id) {
          // It's the bot's comment. Let's parse the artifact ID from the body or just infer it.
          // Wait, the bot says: "u/player has discovered the **RELIC OF X**!"
          // This is a bit hard to parse reliably.
          // Instead, when the bot posts a clue, we could save parentId -> artifactId in Redis!
          const claimedArtifactId = await redis.get(`clue_comment:${parentId}`);
          if (claimedArtifactId) {
            
            // Check if this was a Golden Age artifact that requires 100 clicks
            const cycleIdRaw = await redis.get(`clue_comment_cycle:${parentId}`);
            if (cycleIdRaw) {
              const userClicksRaw = await redis.get(`userClicks:${context.postId}:${cycleIdRaw}:${username}`);
              const userClicks = parseInt(userClicksRaw || '0');
              if (userClicks < 100) {
                await reddit.submitComment({
                  id: input.comment.id,
                  text: `Sorry u/${username}, you must contribute at least 100 clicks during the Golden Age to claim this artifact!`
                });
                return c.json({ status: 'success', message: 'Claim denied due to insufficient clicks' }, 200);
              }
            }

            await redis.zAdd(`user_artifacts:${username}`, { member: claimedArtifactId, score: Date.now() });
            
            // Reply confirming the claim
            await reddit.submitComment({
              id: input.comment.id,
              text: `Artifact copied to your gallery, u/${username}! Enjoy the loot.`
            });
          }
        }
      }
    }

    return c.json<TriggerResponse>(
      { status: 'success', message: 'Comment processed' },
      200
    );
  } catch (error) {
    console.error(`Error processing comment: ${error}`);
    return c.json<TriggerResponse>(
      { status: 'error', message: 'Failed to process comment' },
      400
    );
  }
});

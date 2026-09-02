import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';
import { sanitizeQrStyle, type QrStyleConfig } from './qrStyles';

const sql = neon(process.env.DATABASE_URL!);

export interface LinkStats {
  id: number;
  code: string;
  destinationUrl: string;
  label: string | null;
  createdAt: string;
  scanCount: number;
  actionCount: number;
  style: QrStyleConfig | null;
}

/** Creates a new tracked link and returns its short code. */
export async function createLink(
  destinationUrl: string,
  label: string,
  style: QrStyleConfig | null = null
) {
  const code = nanoid(7);
  await sql`
    INSERT INTO links (code, destination_url, label, style)
    VALUES (${code}, ${destinationUrl}, ${label || null}, ${style ? JSON.stringify(style) : null})
  `;
  return { code };
}

interface LinkRow {
  id: number;
  code: string;
  destinationUrl: string;
  label: string | null;
  createdAt: string;
  style: unknown;
  scanCount: number;
  actionCount: number;
}

/** All links with their scan and action counts, newest first. */
export async function getLinksWithStats(): Promise<LinkStats[]> {
  const rows = (await sql`
    SELECT
      l.id,
      l.code,
      l.destination_url AS "destinationUrl",
      l.label,
      l.created_at AS "createdAt",
      l.style,
      COUNT(DISTINCT s.click_id)::int AS "scanCount",
      COUNT(DISTINCT a.id)::int AS "actionCount"
    FROM links l
    LEFT JOIN scans s ON s.link_id = l.id
    LEFT JOIN actions a ON a.click_id = s.click_id
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `) as unknown as LinkRow[];
  // `style` is untrusted at this boundary even though the only current
  // writer sanitizes first — re-validating on read means a malformed row (a
  // future second writer, a manual DB edit) degrades to the default look
  // instead of crashing QrPreview's renderer.
  return rows.map((row) => ({ ...row, style: sanitizeQrStyle(row.style) }));
}

/** Permanently deletes a link and its scan/action history (cascades). */
export async function deleteLink(id: number): Promise<void> {
  await sql`DELETE FROM links WHERE id = ${id}`;
}

/**
 * Logs a scan for the given short code and returns the destination URL to
 * redirect to. Returns null if the code doesn't exist.
 */
export async function recordScan(params: {
  code: string;
  clickId: string;
  userAgent: string;
  referrer: string;
  country: string;
}): Promise<{ destinationUrl: string } | null> {
  const rows = await sql`
    SELECT id, destination_url AS "destinationUrl" FROM links WHERE code = ${params.code}
  `;
  const link = rows[0] as { id: number; destinationUrl: string } | undefined;
  if (!link) return null;

  await sql`
    INSERT INTO scans (link_id, click_id, user_agent, referrer, country)
    VALUES (${link.id}, ${params.clickId}, ${params.userAgent}, ${params.referrer}, ${params.country})
  `;

  return { destinationUrl: link.destinationUrl };
}

/**
 * Logs an action reported by the destination site, tied back to the click
 * ID from the original scan. Returns false if the click ID is unknown
 * (e.g. someone hitting the endpoint directly rather than via a real scan).
 */
export async function recordAction(
  clickId: string,
  actionType: string,
  metadata: unknown
): Promise<boolean> {
  const rows = await sql`SELECT click_id FROM scans WHERE click_id = ${clickId}`;
  if (rows.length === 0) return false;

  await sql`
    INSERT INTO actions (click_id, action_type, metadata)
    VALUES (${clickId}, ${actionType}, ${JSON.stringify(metadata ?? {})})
  `;
  return true;
}

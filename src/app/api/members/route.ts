import { NextRequest } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// GET /api/members — list members with their (multivalued) roles,
// aggregated via array_agg + GROUP BY to flatten Member_Roles per member.
export async function GET() {
  const result = await query(
    `SELECT m.member_id, m.name,
            COALESCE(array_agg(mr.role ORDER BY mr.role) FILTER (WHERE mr.role IS NOT NULL), '{}') AS roles
     FROM Members m
     LEFT JOIN Member_Roles mr ON mr.member_id = m.member_id
     GROUP BY m.member_id, m.name
     ORDER BY m.name ASC`
  );
  return Response.json({ members: result.rows });
}

const MemberSchema = z.object({
  name: z.string().min(1).max(100),
  roles: z.array(z.string().min(1).max(50)).default([]),
});

// POST /api/members — admin only. Member row + its role rows in one transaction.
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await request.json().catch(() => null);
  const parsed = MemberSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, roles } = parsed.data;

  const member = await withTransaction(async (client) => {
    const ins = await client.query(`INSERT INTO Members (name) VALUES ($1) RETURNING member_id, name`, [name]);
    for (const role of new Set(roles)) {
      await client.query(`INSERT INTO Member_Roles (member_id, role) VALUES ($1, $2)`, [ins.rows[0].member_id, role]);
    }
    return ins.rows[0];
  });
  return Response.json({ member }, { status: 201 });
}

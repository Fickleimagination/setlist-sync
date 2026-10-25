import { query } from "@/lib/db";

// GET /api/members — list members with their (multivalued) roles,
// aggregated via array_agg + GROUP BY to flatten Member_Roles per member.
export async function GET() {
  const result = await query(
    `SELECT m.member_id, m.name, array_agg(mr.role ORDER BY mr.role) AS roles
     FROM Members m
     LEFT JOIN Member_Roles mr ON mr.member_id = m.member_id
     GROUP BY m.member_id, m.name
     ORDER BY m.name ASC`
  );
  return Response.json({ members: result.rows });
}

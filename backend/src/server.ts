import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 5000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'] as const;
const priorities = ['Low', 'Medium', 'High'] as const;
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173' }));
app.use(express.json());

async function initialize() {
  await pool.query(`CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL UNIQUE,
    role VARCHAR(160) NOT NULL, stage VARCHAR(30) NOT NULL DEFAULT 'Applied',
    source VARCHAR(80) NOT NULL DEFAULT 'Careers page', priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    rating INTEGER NOT NULL DEFAULT 3 CHECK (rating BETWEEN 1 AND 5), notes TEXT NOT NULL DEFAULT '',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM candidates');
  if (count.rows[0].count === 0) {
    const demo = [
      ['Ava Patel','ava.patel@example.com','Frontend Engineer','Interview','LinkedIn','High',5,'Strong React and accessibility fundamentals.'],
      ['Noah Williams','noah.w@example.com','Backend Engineer','Screening','Referral','Medium',4,'Experience with APIs and PostgreSQL.'],
      ['Mia Chen','mia.chen@example.com','Product Designer','Offer','Careers page','High',5,'Excellent portfolio and collaboration skills.'],
      ['Liam Johnson','liam.j@example.com','Full Stack Developer','Applied','Indeed','Medium',3,'Review project portfolio.'],
      ['Isabella Garcia','isabella.g@example.com','QA Engineer','Hired','Referral','Low',4,'Offer accepted; start date confirmed.'],
      ['Ethan Brown','ethan.b@example.com','Frontend Engineer','Rejected','LinkedIn','Low',2,'Role required more production experience.'],
      ['Sophia Wilson','sophia.w@example.com','Backend Engineer','Interview','Careers page','High',4,'Technical round scheduled.'],
      ['Oliver Martin','oliver.m@example.com','Full Stack Developer','Applied','GitHub','Medium',3,'Interesting open-source contributions.']
    ];
    for (const c of demo) await pool.query('INSERT INTO candidates(name,email,role,stage,source,priority,rating,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(email) DO NOTHING', c);
  }
}

const candidateSchema = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(180),
  role: z.string().trim().min(2).max(160), stage: z.enum(stages).default('Applied'),
  source: z.string().trim().min(1).max(80).default('Careers page'),
  priority: z.enum(priorities).default('Medium'), rating: z.number().int().min(1).max(5).default(3),
  notes: z.string().max(5000).default('')
});
const fields = 'id, name, email, role, stage, source, priority, rating, notes, applied_at AS "appliedAt", updated_at AS "updatedAt"';
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'mini-ats-api' }));
app.get('/api/meta', (_req, res) => res.json({ stages, priorities }));
app.get('/api/candidates', async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || '').trim();
    const stage = String(req.query.stage || 'All');
    const role = String(req.query.role || 'All');
    const values: unknown[] = [];
    const where: string[] = [];
    if (search) { values.push(`%${search}%`); where.push(`(name ILIKE $${values.length} OR email ILIKE $${values.length} OR role ILIKE $${values.length})`); }
    if (stage !== 'All') { values.push(stage); where.push(`stage = $${values.length}`); }
    if (role !== 'All') { values.push(role); where.push(`role = $${values.length}`); }
    const result = await pool.query(`SELECT ${fields} FROM candidates ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC, id DESC`, values);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Unable to load candidates.' }); }
});
app.get('/api/dashboard', async (_req, res) => {
  try {
    const totals = await pool.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE stage NOT IN ('Hired','Rejected'))::int AS active,
      COUNT(*) FILTER (WHERE stage='Interview')::int AS interviews,
      COUNT(*) FILTER (WHERE stage='Offer')::int AS offers,
      COUNT(*) FILTER (WHERE stage='Hired')::int AS hired,
      COUNT(*) FILTER (WHERE applied_at >= NOW() - INTERVAL '7 days')::int AS new_this_week FROM candidates`);
    const pipeline = await pool.query(`SELECT stage, COUNT(*)::int AS count FROM candidates GROUP BY stage ORDER BY CASE stage WHEN 'Applied' THEN 1 WHEN 'Screening' THEN 2 WHEN 'Interview' THEN 3 WHEN 'Offer' THEN 4 WHEN 'Hired' THEN 5 ELSE 6 END`);
    const recent = await pool.query(`SELECT ${fields} FROM candidates ORDER BY applied_at DESC LIMIT 5`);
    res.json({ ...totals.rows[0], pipeline: pipeline.rows, recent: recent.rows });
  } catch { res.status(500).json({ error: 'Unable to load dashboard.' }); }
});
app.post('/api/candidates', async (req, res) => {
  const parsed = candidateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid candidate data.' });
  const c = parsed.data;
  try {
    const result = await pool.query(`INSERT INTO candidates(name,email,role,stage,source,priority,rating,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${fields}`,
      [c.name,c.email,c.role,c.stage,c.source,c.priority,c.rating,c.notes]);
    res.status(201).json(result.rows[0]);
  } catch (e: any) { if (e.code === '23505') return res.status(409).json({ error: 'A candidate with this email already exists.' }); res.status(500).json({ error: 'Unable to create candidate.' }); }
});
app.patch('/api/candidates/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid candidate ID.' });
  const parsed = candidateSchema.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return res.status(400).json({ error: parsed.success ? 'No changes provided.' : parsed.error.issues[0]?.message });
  const allowed = ['name','email','role','stage','source','priority','rating','notes'];
  const entries = Object.entries(parsed.data).filter(([k]) => allowed.includes(k));
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`);
  const values = entries.map(([,v]) => v); values.push(id);
  try {
    const result = await pool.query(`UPDATE candidates SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING ${fields}`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Candidate not found.' });
    res.json(result.rows[0]);
  } catch (e: any) { if (e.code === '23505') return res.status(409).json({ error: 'A candidate with this email already exists.' }); res.status(500).json({ error: 'Unable to update candidate.' }); }
});
app.delete('/api/candidates/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid candidate ID.' });
  try { const result = await pool.query('DELETE FROM candidates WHERE id=$1', [id]); if (!result.rowCount) return res.status(404).json({ error: 'Candidate not found.' }); res.status(204).end(); }
  catch { res.status(500).json({ error: 'Unable to delete candidate.' }); }
});
initialize().then(() => app.listen(port, () => console.log(`Mini ATS API listening on ${port}`))).catch(err => { console.error('Database initialization failed:', err); process.exit(1); });

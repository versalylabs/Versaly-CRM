import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || '').trim();
  const subject = String(body.subject || '').trim();
  const templateBody = String(body.body || '').trim();
  const category = String(body.category || '').trim() || null;

  if (!name || !subject || !templateBody) {
    return NextResponse.json({ error: 'Name, subject, and email body are required.' }, { status: 400 });
  }

  try {
    const template = await prisma.emailTemplate.create({
      data: { name, subject, body: templateBody, category, isActive: body.isActive !== false },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A template with that name already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not create email template.' }, { status: 500 });
  }
}

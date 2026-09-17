import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getConnectedChannelAccounts,
  upsertConnectedChannelAccount,
  disconnectChannelAccount,
} from '@/lib/inbox';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await getConnectedChannelAccounts(organizationId);
    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error: any) {
    console.error('Error in GET /api/inbox/channels:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch connected channels' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      channel,
      accountName,
      accountHandle,
      externalAccountId,
      accessToken,
      refreshToken,
      appId,
      appSecret,
      webhookSecret,
      avatarUrl,
      metadata,
    } = body;

    const allowedChannels = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X', 'WHATSAPP', 'EMAIL'];
    if (!channel || !allowedChannels.includes(channel.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid channel. Supported: ${allowedChannels.join(', ')}` },
        { status: 400 }
      );
    }

    if (!accountHandle || !accountHandle.trim()) {
      return NextResponse.json({ error: 'Account handle or username is required' }, { status: 400 });
    }

    const cleanHandle = accountHandle.trim().startsWith('@') || channel.toUpperCase() === 'FACEBOOK'
      ? accountHandle.trim()
      : `@${accountHandle.trim()}`;

    const cleanName = accountName && accountName.trim()
      ? accountName.trim()
      : `${cleanHandle} (${channel.toUpperCase()})`;

    const account = await upsertConnectedChannelAccount({
      organizationId,
      channel: channel.toUpperCase(),
      accountName: cleanName,
      accountHandle: cleanHandle,
      externalAccountId: externalAccountId || null,
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
      appId: appId || null,
      appSecret: appSecret || null,
      webhookSecret: webhookSecret || null,
      avatarUrl: avatarUrl || null,
      metadata: metadata || null,
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        channel: account.channel,
        accountName: account.accountName,
        accountHandle: account.accountHandle,
        externalAccountId: account.externalAccountId,
        status: account.status,
        connectedAt: account.connectedAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/inbox/channels:', error);
    return NextResponse.json({ error: error.message || 'Failed to connect channel' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const organizationId = session?.user?.organizationId;
    if (!session || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let accountId = searchParams.get('id');

    if (!accountId) {
      try {
        const body = await req.json();
        accountId = body.accountId || body.id;
      } catch (e) {
        // query param was checked
      }
    }

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    await disconnectChannelAccount(organizationId, accountId);
    return NextResponse.json({ success: true, message: 'Channel account disconnected' });
  } catch (error: any) {
    console.error('Error in DELETE /api/inbox/channels:', error);
    return NextResponse.json({ error: error.message || 'Failed to disconnect channel' }, { status: 500 });
  }
}

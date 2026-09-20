import { CommunicationChannel, CommunicationProvider } from './types';
import { EmailProvider } from './email.provider';
import { WhatsAppProvider } from './whatsapp.provider';
import { InstagramProvider } from './instagram.provider';
import { FacebookProvider } from './facebook.provider';
import { XProvider } from './x.provider';
import { TikTokProvider } from './tiktok.provider';

class ProviderRegistry {
  private providers: Map<CommunicationChannel, CommunicationProvider> = new Map();

  constructor() {
    this.register(new EmailProvider());
    this.register(new WhatsAppProvider());
    this.register(new InstagramProvider());
    this.register(new FacebookProvider());
    this.register(new XProvider());
    this.register(new TikTokProvider());
  }

  public register(provider: CommunicationProvider) {
    this.providers.set(provider.channel, provider);
  }

  public getProvider(channel: CommunicationChannel | string): CommunicationProvider | undefined {
    return this.providers.get(channel.toUpperCase() as CommunicationChannel);
  }

  public getAllProviders(): CommunicationProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();

import { ArrowUpRight } from 'lucide-react';
import { SiDiscord } from 'react-icons/si';
import { PageHeader } from '@/components/PageHeader';
import { config } from '@/config';
import { useDiscord } from '@/extension/useDiscord';
import { DiscordIntegration, DiscordSettings } from './IntegrationSettings';
import { settingsUi } from './settingsStyles';

/** Discord rich presence (DiscordScreen on the phone): the account, then how the card reads. */
export default function DiscordSettingsPage() {
  const status = useDiscord();
  return (
    <div className={settingsUi.centered}>
      <PageHeader title="Discord" />
      <div className={settingsUi.body}>
        <section className={settingsUi.group}>
          <div className={settingsUi.integrationPlain}>
            <span className={settingsUi.integrationName}>Account</span>
            <DiscordIntegration />
          </div>
        </section>
        {status.state === 'ready' && !status.discord.connected && (
          <p className={settingsUi.footer}>
            Connect opens a page from the extension that reads your Discord session from a discord.com tab. The web player never
            sees it. This uses your account’s own token, which Discord’s terms don’t allow.
          </p>
        )}
        {status.state === 'ready' && status.discord.connected && (
          <>
            <h2 className={settingsUi.sectionHeader}>Presence</h2>
            <DiscordSettings />
          </>
        )}

        <h2 className={settingsUi.sectionHeader}>Community</h2>
        <section className={settingsUi.group}>
          <a
            href={config.discordCommunityUrl}
            target="_blank"
            rel="noreferrer"
            className={`${settingsUi.integration} ${settingsUi.linkRow}`}
          >
            <span className={settingsUi.integrationIcon} style={{ backgroundColor: '#5865f2' }}>
              <SiDiscord size={15} />
            </span>
            <span className={settingsUi.integrationName}>Join Raaga Discord Server</span>
            <span className={settingsUi.value}>
              Join Community
              <ArrowUpRight size={16} />
            </span>
          </a>
        </section>
      </div>
    </div>
  );
}

import { useStore } from '../store/useStore';
import { PlayerModal } from './PlayerModal';
import { TeamModal } from './TeamModal';
import { UserModal } from './UserModal';
import { LeagueModal } from './LeagueModal';
import { LineupModal } from './LineupModal';
import { ResultModal } from './ResultModal';
import { FixtureModal } from './FixtureModal';
import { FriendlyModal } from './FriendlyModal';
import { EventModal } from './EventModal';
import { ImportModal } from './ImportModal';
import { NuligaSyncModal } from './NuligaSyncModal';
import { RulesModal } from '../screens/Training';

export function Modals() {
  const s = useStore();
  return (
    <>
      {s.playerModal && <PlayerModal />}
      {s.teamModal && <TeamModal />}
      {s.userModal && <UserModal />}
      {s.leagueModal && <LeagueModal />}
      {s.lineupModal && <LineupModal />}
      {s.resultModal && <ResultModal />}
      {s.fixtureModal && <FixtureModal />}
      {s.friendlyModal && <FriendlyModal />}
      {s.eventModal && <EventModal />}
      {s.importOpen && <ImportModal />}
      {s.nuligaSync && <NuligaSyncModal />}
      {s.rulesMode && <RulesModal />}
    </>
  );
}

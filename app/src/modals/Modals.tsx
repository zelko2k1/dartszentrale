import { useStore } from '../store/useStore';
import { PlayerModal } from './PlayerModal';
import { TeamModal } from './TeamModal';
import { UserModal } from './UserModal';
import { LeagueModal } from './LeagueModal';
import { FixtureModal } from './FixtureModal';
import { EventModal } from './EventModal';
import { ImportModal } from './ImportModal';
import { RulesModal } from '../screens/Training';

export function Modals() {
  const s = useStore();
  return (
    <>
      {s.playerModal && <PlayerModal />}
      {s.teamModal && <TeamModal />}
      {s.userModal && <UserModal />}
      {s.leagueModal && <LeagueModal />}
      {s.fixtureModal && <FixtureModal />}
      {s.eventModal && <EventModal />}
      {s.importOpen && <ImportModal />}
      {s.rulesMode && <RulesModal />}
    </>
  );
}

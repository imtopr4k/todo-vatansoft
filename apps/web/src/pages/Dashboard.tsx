import { me } from '../auth';
import Tickets from './Tickets';
import Header from '../Components/Header';

export default function Dashboard(){
  const user = me();
  return (
    <>
        <Tickets />
    </>
  );
}

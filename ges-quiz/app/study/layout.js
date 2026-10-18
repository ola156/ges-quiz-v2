import AppFrame from '../../components/AppFrame';

export const dynamic = 'force-dynamic';

export default function Layout({ children }) {
  return <AppFrame>{children}</AppFrame>;
}
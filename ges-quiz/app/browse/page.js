import { redirect } from 'next/navigation';

// The old browse page is gone. Old links and bookmarks land on the new practice page.
export default function Browse() {
  redirect('/practice');
}
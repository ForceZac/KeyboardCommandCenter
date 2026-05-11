'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const name = session?.user?.name ?? 'User';
  const image = session?.user?.image;
  // Initials fallback: first letter of each word in name, up to 2 chars
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`User menu for ${name}`}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            width={32}
            height={32}
            className="rounded-full w-8 h-8 object-cover"
          />
        ) : (
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-semibold select-none">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{name}</p>
            {session?.user?.email && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {session.user.email}
              </p>
            )}
          </div>
          <Link
            href="/collections"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            My Collections
          </Link>
          {session?.user?.id && (
            <Link
              href={`/profile/${session.user.id}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              My Profile
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

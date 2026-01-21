import './globals.css'

export const metadata = {
  title: 'Union Park Recon Tracker',
  description: 'Pre-Owned Vehicle Reconditioning Management System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

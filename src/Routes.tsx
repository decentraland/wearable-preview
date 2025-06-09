import { memo, type FC } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Preview } from './components/Preview'
import { UnityPreview } from './components/UnityPreview'

export const AppRoutes: FC = memo(() => {
  return (
    <Routes>
      <Route path="/" element={<Preview />} />
      <Route path="/unity" element={<UnityPreview />} />
    </Routes>
  )
})

import { useParams } from 'react-router-dom'

export default function ResourceDetail() {
  const { id } = useParams()
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Resource: {id}</h1>
      <div className="card-surface p-6 rounded-xl border border-border">
        <p className="text-sm text-muted-foreground">Resource Details Loading...</p>
      </div>
    </div>
  )
}

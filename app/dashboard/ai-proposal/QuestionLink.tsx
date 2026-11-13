'use client'

export default function QuestionLink({ id }: { id: string }) {
  return (
    <a href={`#${id}`} className="ai-proposal-card-link" onClick={() => {
      const question = document.getElementById(id)
      if (question instanceof HTMLDetailsElement) {
        question.open = true
        question.querySelector('summary')?.focus({ preventScroll: true })
      }
    }}>答える →</a>
  )
}

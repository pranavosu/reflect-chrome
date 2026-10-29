// block_page.ts replaces a blocked site with reflect's block page. The page is
// rendered into a closed shadow root, so the site's CSS and scripts can't
// restyle or read it. Markup and styles are bundled in from src/block/.
import BlobAnimation from './blob_animation'
import blockHtml from './block/block.html'
import blockCss from './block/block.css'
import type { IntentResult } from './messages'

const BLOCK_ROOT_ID = 'reflect-root'

export interface BlockPageOptions {
  domain: string
  minutes: number
  question: string
  blobs: boolean
  shadedBlobs: boolean
  // asks for a verdict on the reason the user gave
  judge: (intent: string) => Promise<IntentResult>
  // called once, when the user starts typing
  onFirstInput: () => void
}

const NOTE_RESET_MS = 4000

const REJECTIONS: Record<Exclude<IntentResult, 'ok'>, string> = {
  too_short: 'your reason is a little short. be more specific!',
  invalid: "that doesn't sound productive. try being more specific.",
  error: "reflect couldn't check that reason. try again.",
}

export function isBlockPageShown(): boolean {
  return document.getElementById(BLOCK_ROOT_ID) !== null
}

export function showBlockPage(options: BlockPageOptions): void {
  // stop the site loading and swap the whole document for a blank one
  window.stop()
  const html = document.documentElement
  for (const attr of Array.from(html.attributes)) html.removeAttribute(attr.name)

  const head = document.createElement('head')
  const meta = document.createElement('meta')
  meta.name = 'viewport'
  meta.content = 'width=device-width, initial-scale=1'
  const title = document.createElement('title')
  title.textContent = 'reflect.'
  // @font-face doesn't work inside a shadow root, so fonts are declared here
  const fonts = document.createElement('style')
  fonts.textContent = `
    @font-face { font-family: circular; src: url(${chrome.runtime.getURL('res/circular.ttf')}); font-display: swap; }
    @font-face { font-family: circular-lt; src: url(${chrome.runtime.getURL('res/circular-light.ttf')}); font-display: swap; }
  `
  head.append(meta, title, fonts)

  const body = document.createElement('body')
  body.style.margin = '0'
  const host = document.createElement('div')
  host.id = BLOCK_ROOT_ID
  body.append(host)
  html.replaceChildren(head, body)

  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `<style>${blockCss}</style>${blockHtml}`

  // some sites keep rewriting the document from scripts that already ran;
  // put the block page back if that removes it
  new MutationObserver(() => {
    if (!host.isConnected) {
      document.documentElement.replaceChildren(head, body)
    }
  }).observe(document, { childList: true, subtree: true })

  const $ = <T extends Element>(selector: string) => root.querySelector(selector) as T
  const form = $<HTMLFormElement>('form')
  const field = $<HTMLDivElement>('.field')
  const input = $<HTMLInputElement>('input')
  const button = $<HTMLButtonElement>('button')
  const note = $<HTMLParagraphElement>('.note')

  $<HTMLParagraphElement>('.question').textContent = options.question
  $<HTMLAnchorElement>('.options-link').href = chrome.runtime.getURL('res/pages/options.html')

  const minutesText = `${options.minutes} ${options.minutes === 1 ? 'minute' : 'minutes'}`
  const defaultNote = `a good reason opens ${options.domain} for ${minutesText}.`
  let resetTimer = 0
  const setNote = (message: string, isError: boolean, temporary: boolean) => {
    window.clearTimeout(resetTimer)
    note.textContent = message
    note.classList.toggle('error', isError)
    if (temporary) {
      resetTimer = window.setTimeout(() => setNote(defaultNote, false, false), NOTE_RESET_MS)
    }
  }
  setNote(defaultNote, false, false)

  if (options.blobs) {
    const svg = $<SVGSVGElement>('svg')
    new BlobAnimation(svg, $<HTMLDivElement>('.page'), { shaded: options.shadedBlobs }).start()
  } else {
    $<SVGSVGElement>('svg').remove()
  }

  const setBusy = (busy: boolean) => {
    button.disabled = busy
    button.textContent = busy ? 'checking.' : 'enter.'
  }

  input.addEventListener('input', options.onFirstInput, { once: true })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const intent = input.value.trim()
    if (intent === '') return

    setBusy(true)
    const result: IntentResult = await options.judge(intent)
    if (result === 'ok') {
      // the site is open now; reloading shows it
      setNote(`got it! ${minutesText} starting now.`, false, false)
      location.reload()
      return
    }

    setNote(REJECTIONS[result], true, true)
    setBusy(false)
    input.value = ''
    input.focus()
    field.classList.remove('shake')
    void field.offsetWidth // restart the animation
    field.classList.add('shake')
  })

  input.focus()
}

import { getStorage, setStorage } from './storage'
import { byId } from './ui'

const getSettingsHTMLString = () => {
  return `
    <table class="options_panel">
        <tr>
            <td style="width:60%">
                <h3 class="setting">enable blobs.</h3>
                <p class="subtext">whether to render the interactive blobs on the block page.</p>
            </td>
            <td>
                <input class='toggle' id='enableBlobs' type='checkbox'>
                <label class='toggle-button' for='enableBlobs'></label>
            </td>
        </tr>
        <tr>
            <td>
                <h3 class="setting">enable 3D.</h3>
                <p class="subtext">whether to enable the 3D-like effect on the blobs on the block page.</p>
            </td>
            <td>
                <input class='toggle' id='enable3D' type='checkbox'>
                <label class='toggle-button' for='enable3D'></label>
            </td>
        </tr>
        <tr>
            <td>
                <h3 class="setting">whitelist time.</h3>
                <p class="subtext">time allowed on a website after successful intent (minutes).</p>
            </td>
            <td>
                <input id="whitelistTime" type="number" min="0">
            </td>
        </tr>
    </table>
    <p id="statusMessage">
        <span id="statusContent"></span>
        <span>&nbsp;</span>
    </p>
    `
}

const saveSettings = () => {
  const whitelistTime: number = Number(byId<HTMLInputElement>('whitelistTime').value)
  const enableBlobs: boolean = byId<HTMLInputElement>('enableBlobs').checked
  const enable3D: boolean = byId<HTMLInputElement>('enable3D').checked

  setStorage({
    whitelistTime: whitelistTime,
    enableBlobs: enableBlobs,
    enable3D: enable3D,
  }).then(() => {
    const status = document.getElementById('statusContent')
    if (status === null) return
    status.textContent = 'options saved.'
    setTimeout(() => {
      status.textContent = ''
    }, 1500)
  })
}

export default () => {
  document.addEventListener('DOMContentLoaded', () => {
    const optionsDiv: HTMLElement | null = document.getElementById('options')
    const goToEndButton: HTMLElement | null = document.getElementById('page3button')
    if (optionsDiv === null || goToEndButton === null) {
      return
    }

    goToEndButton.innerText = 'skip.'

    const newOptionsSection: HTMLDivElement = document.createElement('div')
    newOptionsSection.innerHTML = `
            <div class="text-section">
                <h2>configure.</h2>
                <p>buttons and knobs to customize your reflect experience.</p>
                ${getSettingsHTMLString()}
                <a id="saveButton" class="lt-hover white_button shadow nextPage">save!</a>
            </div>
            `
    optionsDiv.after(newOptionsSection)
    newOptionsSection.querySelector('#saveButton')?.addEventListener('click', saveSettings)

    getStorage().then((storage) => {
      byId<HTMLInputElement>('whitelistTime').value = String(storage.whitelistTime)
      byId<HTMLInputElement>('enableBlobs').checked = storage.enableBlobs
      byId<HTMLInputElement>('enable3D').checked = storage.enable3D
    })
  })
}

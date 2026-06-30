const inputScan = document.querySelector('#scan-input');
const inputDelimiter = document.querySelector('#input-delimiter');
const copyButton = document.querySelector('#copy-button');
const resultText = document.querySelector('#result-text');
const resultTableData = document.querySelector('#result-table-data');

const idNumberLengthInput = document.querySelector('#input-id-number-length');
const scanThresholdInput = document.querySelector('#input-scan-threshold');
const deliveryNoteUpdateProgress = document.querySelector('#delivery-note-progress');

const deliveryNoteInput = document.querySelector('#delivery-note-section');
const deliveryNoteDelimiterInput = document.querySelector('#input-delimiter-delivery');
const loadDeliveryNoteButton = document.querySelector('#load-delivery-note');
const deliveryNoteTableData = document.querySelector('#delivery-note-table-data');
    
let idNumberLength = 5; // Length of the ID number to extract from the scanned data
let scanLengthThreshold = 5; // Minimum length of scanned data to process
const debounceTime = 200; // Time to wait after the last input before processing

let timer = null;
let counter = 0;
let counterValids = 0;
let results = [];
const parsers = [];

let deliveryNoteResults = [];

const init = () => {
    inputScan.focus();
    inputDelimiter.value = ',';
    deliveryNoteDelimiterInput.value = ',';
    updateInputParameters();
}

const updateInputParameters = () => {
    const newIdNumberLength = parseInt(idNumberLengthInput.value, 10);
    const newScanThreshold = parseInt(scanThresholdInput.value, 10);

    if (!isNaN(newIdNumberLength)) {
        idNumberLength = newIdNumberLength;
    }

    if (!isNaN(newScanThreshold)) {
        scanLengthThreshold = newScanThreshold;
    }
}

const lockLengthParameter = () => {
    idNumberLengthInput.setAttribute('readonly', true);
    idNumberLengthInput.classList.add('locked');
}

const addTooltipToElements = (querySelector) => {
    const elements = document.querySelectorAll(querySelector);
    elements.forEach((element) => {
        element.setAttribute('title', element.textContent);
    });
}

// #region Parsers
const registerParsers = () => {
    parsers.push(parseAfterSER);
    parsers.push((data) => parseLastNCharacters(data, idNumberLength));
}

const parseData = (data) => {
    for (const parser of parsers) {
        const result = parser(data);
        if (result) {
            return result;
        }
    }

    return undefined;
}

const checkNumberOrNull = (data) => {
    if (isNaN(data)) {
        console.warn('Parsed data is not a valid number:', data);
        return null;
    }

    return data;
}

const parseAfterSER = (data) => {
    const serIndex = data.indexOf('SER');
    if (serIndex === -1) {
        return null;
    }

    const number = data.split('SER')[1];
    if (number.length !== idNumberLength) {
        return null;
    }

    console.log('Parsed using SER parser:', number);
    // return checkNumberOrNull(number);
    return number;
}

const parseLastNCharacters = (data, n) => {
    if (data.length < n || data.length !== idNumberLength) {
        return null;
    }

    const number = data.substring(data.length - n);
    console.log('Parsed using last N characters parser:', number);
    // return checkNumberOrNull(number);
    return number;
}
// #endregion

// #region Scan Input Handling
const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Text copied to clipboard');
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

const createResultText = () => {
    if (results.length === 0) {
        return 'No scans processed yet.';
    }

    const delimiter = inputDelimiter.value || ',';
    const idNumbers = results
        .filter(e => e.idNumber)
        .map(e => e.idNumber);

    const uniqueIdNumbers = [...new Set(idNumbers)];
    return uniqueIdNumbers.join(delimiter);
}

const processScan = (data) => {
    console.log(counter++, data);
    const parsedIdNumber = parseData(data);
    let isDuplicate = false;
    let vIndex = undefined;
    if (!parsedIdNumber) {
        console.warn('Failed to parse ID number from scan data:', data);
    } else {
        isDuplicate = results.some(e => e.idNumber === parsedIdNumber);
        if (isDuplicate) {
            console.warn('Duplicate ID number detected:', parsedIdNumber);
        } else {
            counterValids++;
            vIndex = counterValids;
        }
    }

    const isFound = parsedIdNumber === undefined
        ? false
        : deliveryNoteResults.some(e => e.idNumber === parsedIdNumber);
    results.push({ index: counter, vIndex: vIndex, idNumber: parsedIdNumber, rawData: data, isDuplicate, isFound });
    const renderedRow = renderScan(counter, vIndex, parsedIdNumber, data, isDuplicate, isFound);
    resultTableData.insertAdjacentHTML('afterbegin', renderedRow);
    addTooltipToElements('#data-table td');

    resultText.textContent = createResultText();
    if (isFound) {
        const deliveryNoteEntry = deliveryNoteResults.find(e => e.idNumber === parsedIdNumber);
        if (deliveryNoteEntry) {
            deliveryNoteEntry.isFound = true;
            renderDeliveryNoteResults();
            updateDeliveryNoteProgress();
        }
    }
}

const renderScan = (index, vIndex, number, rawData, idDuplicate, isFound) => {
    return `<tr class="${vIndex ? '' : 'error'} ${idDuplicate ? ' duplicate' : ''} data-row="${index}">
                <td>${String(index).padStart(3, '0')}</td>
                <td>${vIndex === undefined ? '---' : String(vIndex).padStart(3, '0')}</td>
                <td>${number}</td>
                <td>${vIndex === undefined ? '---' : isFound ? '✅ Yes' : '❌ No'}</td>
                <td>${rawData}</td>
            </tr>`;
}

const renderScans = () => {
    results.sort((a, b) => b.index - a.index); // Sort by index to maintain the original order
    resultTableData.innerHTML = ''; // Clear previous results
    for (const result of results) {
        const renderedRow = renderScan(result.index, result.vIndex, result.idNumber, result.rawData, result.isDuplicate, result.isFound);
        resultTableData.insertAdjacentHTML('beforeend', renderedRow);
    }
}

const addEventListenersScan = () => {
    inputScan.addEventListener('input', (event) => {
        const scanData = event.target.value;
        if (scanData.length < scanLengthThreshold) {
            return;
        }

        clearTimeout(timer); // Clear the previous timer if it exists
        timer = setTimeout(() => {
            processScan(scanData);
            event.target.value = ''; // Clear the input after processing
        }, debounceTime);
    });

    inputDelimiter.addEventListener('input', () => {
        resultText.textContent = createResultText();
    });

    copyButton.addEventListener('click', () => {
        const textToCopy = createResultText();
        copyToClipboard(textToCopy);
    });
}
// #endregion

// #region Delivery Note Handling
const loadDeliveryNote = (data) => {
    const delimiter = deliveryNoteDelimiterInput.value || ',';
    const idNumbers = data
        .split(delimiter)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    let index = deliveryNoteResults.length; // Start index from the current length of deliveryNoteResults
    let vIndex = deliveryNoteResults.filter(e => e.vIndex).length; // Start vIndex from the count of valid entries
    for (const id of idNumbers) {
        const parsedId = id.length === idNumberLength 
            ? id 
            : undefined; // Only accept IDs that match the exact length

        const isDuplicate = parsedId ? deliveryNoteResults.some(e => e.idNumber === parsedId) : false;
        const isValid = parsedId !== undefined && isDuplicate === false;
        deliveryNoteResults.push({
            index: ++index,
            vIndex: isValid ? ++vIndex : vIndex, // Increment vIndex only if parsedId is valid
            idNumber: parsedId,
            isFound: isValid ? false : undefined, // Set isFound to undefined if parsedId is invalid
            rawData: id,
            isDuplicate
        });
    }
}

const renderDeliveryNoteResults = () => {
    deliveryNoteResults.sort((a, b) => a.index - b.index); // Sort by index to maintain the original order
    deliveryNoteTableData.innerHTML = ''; // Clear previous results
    for (const result of deliveryNoteResults) {
        const { index, vIndex, idNumber, isFound, rawData, isDuplicate } = result;
        const renderedRow = renderDeliveryNoteRow(index, vIndex, idNumber, isFound, rawData, isDuplicate);
        deliveryNoteTableData.insertAdjacentHTML('beforeend', renderedRow);
    }

    addTooltipToElements('#delivery-note-table td');
}

const renderDeliveryNoteRow = (index, vIndex, idNumber, found, rawData, isDuplicate) => {
    return `<tr class="${found === undefined ? 'error' : ''} ${isDuplicate ? ' duplicate' : ''} data-row="${index}">
                <td>${String(index).padStart(3, '0')}</td>
                <td>${found === undefined ? '---' : String(vIndex).padStart(3, '0')}</td>
                <td>${idNumber}</td>
                <td>${found === undefined ? '---' : found ? '✅ Yes' : '❌ No'}</td>
                <td>${rawData}</td>
            </tr>`;
}

const updateIsFound = () => {
    const validDeliveryNoteResults = deliveryNoteResults.filter(e => !e.isDuplicate && e.vIndex && e.idNumber);
    const validScanResults = results.filter(e => !e.isDuplicate && e.vIndex && e.idNumber);
    for (const scan of validScanResults) {
        const deliveryNoteEntry = validDeliveryNoteResults.find(e => e.idNumber === scan.idNumber);
        if (deliveryNoteEntry) {
            deliveryNoteEntry.isFound = true;
            scan.isFound = true; // Update the scan result as well
            continue;
        }

        scan.isFound = false; // Update the scan result as well
    }
}

const updateDeliveryNoteProgress = () => {
    const valids = deliveryNoteResults.filter(e => e.idNumber && !e.isDuplicate);
    const total = valids.length;
    const foundCount = valids.filter(e => e.isFound).length;
    const finishSymbol = foundCount === total && total > 0 ? ' 🎉' : '';
    deliveryNoteUpdateProgress.textContent = `Progress: ${foundCount}/${total}${finishSymbol}`;
}

const updateAndRerender = () => {
    updateInputParameters();
    updateIsFound();
    renderDeliveryNoteResults();
    renderScans();
    updateDeliveryNoteProgress();
}

const addEventListenersDeliveryNote = () => {
    loadDeliveryNoteButton.addEventListener('click', () => {
        const data = deliveryNoteInput.value;
        if (!data) {
            return;
        }

        loadDeliveryNote(data);
        lockLengthParameter();
        updateAndRerender();
        inputScan.focus();
    });

    idNumberLengthInput.addEventListener('input', () => {
        updateInputParameters();
        inputScan.focus();
    });

    scanThresholdInput.addEventListener('input', () => {
        updateInputParameters();
        inputScan.focus();
    });
}
// #endregion

init();
addEventListenersScan();
addEventListenersDeliveryNote();
registerParsers();
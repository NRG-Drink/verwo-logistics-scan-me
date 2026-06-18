const inputScan = document.querySelector('#scan-input');
const inputDelimiter = document.querySelector('#input-delimiter');
const copyButton = document.querySelector('#copy-button');
const resultText = document.querySelector('#result-text');
const resultTableData = document.querySelector('#result-table-data');

const idNumberLength = 5; // Length of the ID number to extract from the scanned data
const scanLengthThreshold = 5; // Minimum length of scanned data to process
const waitTimeSeconds = 1; // Time to wait before processing the scan
const debounceTime = 200; // Time to wait after the last input before processing

let timer = null;
let counter = 0;
let counterValids = 0;
let results = [];
const parsers = [];

const init = () => {
    inputScan.focus();
    inputDelimiter.value = ',';
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
    return checkNumberOrNull(number);
}

const parseLastNCharacters = (data, n) => {
    if (data.length < n || data.length !== idNumberLength) {
        return null;
    }

    const number = data.substring(data.length - n);
    console.log('Parsed using last N characters parser:', number);
    return checkNumberOrNull(number);
}
// #endregion

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
    if (!parsedIdNumber) {
        console.warn('Failed to parse ID number from scan data:', data);
    } else {
        isDuplicate = results.some(e => e.idNumber === parsedIdNumber);
        if (isDuplicate) {
            console.warn('Duplicate ID number detected:', parsedIdNumber);
        } else {
            counterValids++;
        }
    }

    results.push({ index: counterValids, idNumber: parsedIdNumber, rawData: data });
    const renderedRow = renderScan(counter, counterValids, parsedIdNumber, data, isDuplicate);
    resultTableData.insertAdjacentHTML('afterbegin', renderedRow);

    resultText.textContent = createResultText();
}

const renderScan = (index, vindex, number, rawData, idDuplicate) => {
    return `<tr class="${number ? '' : 'error'}${idDuplicate ? ' duplicate' : ''}">
                <td>${String(index).padStart(3, '0')}</td>
                <td>${String(vindex).padStart(3, '0')}</td>
                <td>${number}</td>
                <td>${rawData}</td>
            </tr>`;
}

const addEventListeners = () => {
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

init();
addEventListeners();
registerParsers();
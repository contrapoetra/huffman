class Huffman {
    static async encode(string) {
        // let string = "And blood-black nothingness began to spin. A system of cells interlinked, within cells interlinked, within cells interlinked within one stem. And dreadfully distinct against the dark, a tall white fountain played.";
        // let string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        // let string = "tatakrama";

        document.querySelector('.subtitle').innerText = "building Huffman tree...";
        let huffman = Huffman.makeHuffmanTree(string);
        huffman.displayTree();
        let tree = huffman.tree;
        console.log();

        document.querySelector('.subtitle').innerText = "generating lookup table...";
        let traversal = Huffman.traverse(huffman);
        let addresses = traversal[0];
        let originalTable = traversal[1];

        document.querySelector('.subtitle').innerText = "preparing file header...";
        let header = this.header(addresses);
        console.log();
        
        document.querySelector('.subtitle').innerText = "mapping characters...";
        let encodedString = await Huffman.encoding(string, addresses);
        
        console.log(`Encoded string for${string.length < 64 ? ` "${string}"` : ":\n" + string}:`);
        console.log(this.byteBlocks(encodedString));
        
        let stats = `(${string.length * 8} bits -> ${encodedString.length} bits + ${header.length * 8} bits (header) = ${encodedString.length + header.length * 8} bits total, ${(((encodedString.length + header.length * 8) / (string.length * 8)) * 100).toFixed((2))}% ${((encodedString.length + header.length * 8) / (string.length * 8)) < 1 ? "decrease" : "increase"})`;
        console.log(stats);
        document.querySelector('.subtitle').innerText = stats;
        console.log("\n");

        // let decodedString = HuffmanTree.decoding(encodedString, addresses);
        // console.log(`Decoded code "${this.byteBlocks(encodedString)}":`);
        // console.log(decodedString);

        return [encodedString, header, tree, originalTable];
    }

    static async decode(data) {
        const bytes = new Uint8Array(data);
        
        let i = 0;
        let symbolCount = bytes[i];
        let symbols = [];
        let lengths = [];
        for (i = 1; i < symbolCount * 2 + 1; i++) {
            symbols.push(String.fromCharCode(bytes[i]));
            lengths.push(bytes[++i]);
        }

        let encodedString = "";
        for (i; i < bytes.length - 1; i++) {
            encodedString += bytes[i].toString(2).padStart(8, "0");
        }
        encodedString += bytes[bytes.length - 1].toString(2);
        return await this.decoding(encodedString, this.buildLookupFromInput(symbols, lengths));
    }

    static search(data, key) {
        for (let i = 0; i < data.length; i++) {
            let code = "";
            for (let j = 0; j < data[i].address.length; j++) {
                code += data[i].address[j] ? "1" : "0";
            }
            if (code === key) {
                return i;
            }
        }
        return -1;
    }

    static makeHuffmanTree(string) {
        // get all unique characters
        let hashTable = new HashTable(256);
        for (let i = 0; i < string.length; i++) {
            hashTable.add(string.charAt(i));
        }

        let table = hashTable.getTable(); // all unique characters are here

        // create two empty queues
        let q1 = new Queue(table.length); // for the leaf nodes
        let q2 = new Queue(table.length * 2); // for the internal nodes

        // queue all unique characters to q1 as leaf nodes
        // for each Data in Data[], convert it to Node and queue it
        console.log("Char" + "\t" + "Freq");
        for (let i = 0; i < table.length; i++) {
            console.log(table[i].char + "\t" + table[i].count);
            let node = new Node(table[i].char, table[i].count);
            q1.insert(node);
        }
        console.log();

        // dequeue two nodes from both queues with min frequency
        while (q1.size() + q2.size() >= 2) {
            let nodes = new Array(2);
            for (let i = 0; i < nodes.length; i++) {
                if (q2.isEmpty()) {
                    nodes[i] = q1.remove();
                } else if (q1.isEmpty()) {
                    nodes[i] = q2.remove();
                } else if (q1.peek().sum < q2.peek().sum) {
                    nodes[i] = q1.remove();
                } else {
                    nodes[i] = q2.remove();
                }
            }
            let internal = new Node(nodes[0].sum + nodes[1].sum, nodes[0], nodes[1]);
            q2.insert(internal);
        }

        // the root of the final huffman tree is the final huffman tree
        return q2.remove();
    }

    static traverse(root) {
        let nodeStack = new Stack();
        let traceStack = new Stack();
        let lookup = [];
        let current = root;
        let trace = "";

        let originalTable = "";
    
        originalTable += "Char" + "\t" + "Freq" + "\t" + "Code" + '\n';
        while (current != null || !nodeStack.isEmpty()) {
            while (current != null) {
                nodeStack.push(current);
                traceStack.push(trace);
                trace += "0";
                current = current.leftChild;
            }
    
            current = nodeStack.pop();
            trace = traceStack.pop();
    
            if (current.char) {
                let address = trace.split('').map(bit => bit === '1');
                lookup.push(new Data(current.char, address));
                originalTable += `${current.char}\t${current.sum}\t${trace}` + '\n';
            }
    
            if (current.rightChild != null) {
                trace += "1";
            }
            current = current.rightChild;
        }

        this.canonicalCoding(lookup);        
        return [lookup, originalTable];
    }

    static buildLookupFromInput(symbols, lengths) {
        let lookup = [];
        for (let i = 0; i < symbols.length; i++) {
            lookup.push(new Data(symbols[i], "0".repeat(lengths[i]).split('').map(value => value === '0')));
        }
        this.canonicalCoding(lookup);
        return lookup;
    }

    static canonicalCoding(lookup) {
        // canonical huffman coding, as i learned from thread below, but i'm a coward and added the symbols back
        // because in theory it would be cheaper to store 2n-byte header most of the time than to store 256 bytes of header
        // https://stackoverflow.com/questions/759707/efficient-way-of-storing-huffman-tree
        // quick sort by length and then by char
        this.quickSort(lookup, 1);

        // assign canonical code as the new code
        // https://en.wikipedia.org/wiki/Canonical_Huffman_code
        console.log("\nCanonical codes:");
        console.log("Char" + "\t" + "Code" + "\t" + "Canonical code");
        let code = "0".repeat(lookup[0].address.length);
        for (let i = 0; i < lookup.length - 1; i++) {
            const symbol = lookup[i];
            console.log(symbol.char + "\t" + symbol.address.map(value => value ? "1" : "0").join('') + "\t" + code);
            symbol.address = code.split('').map(value => value === "1");
            code = ((parseInt(code, 2) + 1).toString(2) + "0".repeat(lookup[i + 1].address.length - lookup[i].address.length)).padStart(lookup[i + 1].address.length, "0");
        }
        console.log(lookup[lookup.length - 1].char + "\t" + lookup[lookup.length - 1].address.map(value => value ? "1" : "0").join('') + "\t" + code);
        lookup[lookup.length - 1].address = code.split('').map(value => value === "1");

        // quick sort by chsr
        this.quickSort(lookup, 0);

        console.log("\nCanonical codes (sorted by char):")
        console.log("Char" + "\t" + "Code");
        for (let i = 0; i < lookup.length; i++) {
            const symbol = lookup[i];
            let address = "";
            symbol.address.map((value) => {address += value ? "1" : "0";});
            console.log(`${symbol.char}\t${address}`);
        }
    }

    static quickSort(array, mode) {
        let stack = new Stack();
        let n = array.length;
        
        stack.push(0);
        stack.push(n - 1);
        
        while (!stack.isEmpty()) {
            const high = stack.pop();
            const low = stack.pop();
            
            const partition = (arr, low, high) => {
                const pivot = arr[high];
                let i = low - 1;
            
                for (let j = low; j < high; j++) {
                    if (mode === 0 ? arr[j].char.charCodeAt() < pivot.char.charCodeAt() : (arr[j].address.length < pivot.address.length || (arr[j].address.length === pivot.address.length && arr[j].char.charCodeAt() < pivot.char.charCodeAt()))) {
                        i++;
                        [arr[i], arr[j]] = [arr[j], arr[i]];
                    }
                }
            
                [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
                return i + 1;
            };

            const pivotIndex = partition(array, low, high);
            
            if (pivotIndex - 1 > low) {
                stack.push(low);
                stack.push(pivotIndex - 1);
            }
            
            if (pivotIndex + 1 < high) {
                stack.push(pivotIndex + 1);
                stack.push(high);
            }
        }
    }

    static async encoding(string, addresses) {
        let encodedString = "";
        let percentageThing = document.getElementById('percentage');
        let titleDetail = document.querySelector('.title b');
        const chunkSize = 512;
    
        for (let i = 0; i < string.length; i += chunkSize) {
            const end = Math.min(i + chunkSize, string.length);
    
            for (let j = i; j < end; j++) {
                for (let k = 0; k < addresses.length; k++) {
                    if (addresses[k].char === string.charAt(j)) {
                        let address = "";
                        for (let l = 0; l < addresses[k].address.length; l++) {
                            address += addresses[k].address[l] ? "1" : "0";
                        }
                        encodedString += address;
                        break;
                    }
                }
    
                let percentage = Math.round((j / string.length) * 100);
                percentageThing.innerText = percentage;
                titleDetail.innerText = percentage + "%";
            }
    
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    
        percentageThing.innerText = '+';
        return encodedString;
    }
    
    static async decoding(code, addresses) {
        let decodedString = "";
        let currentCode = "";
        let percentageThing = document.getElementById('percentage');
        let titleDetail = document.querySelector('.title b');
        const chunkSize = code.length / 128; // smaller the divider the faster it becomes, i just put this so that it has the progress percentage thingy LMAO
    
        for (let i = 0; i < code.length; i += chunkSize) {
            const end = Math.min(i + chunkSize, code.length);
    
            for (let j = i; j < end; j++) {
                currentCode += code.charAt(j);
                let index = Huffman.search(addresses, currentCode);
                if (index >= 0) {
                    decodedString += addresses[index].char;
                    currentCode = "";
                }

                let percentage = Math.round((j / code.length) * 100);
                percentageThing.innerText = percentage;
                titleDetail.innerText = percentage + "%";
            }
    
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    
        percentageThing.innerText = '+';
        return decodedString;
    }

    static byteBlocks(string) {
        let blocks = [];
        for (let i = 0; i < string.length; i += 8) {
            blocks.push(string.slice(i, i + 8));
        }
        return blocks.join(' ');
    }

    static header(addresses) {
        let headerData = [];
        headerData.push(addresses.length);
        // so it's like for every row of char we store the length of the table (above thing)
        // and then start with the character and its code. for example, [3, 65, 1, 66, 2, 67, 3] means
        // 3 rows,
        //     65 (A) has code with length 1 bit,
        //     66 (B) has code with length 2 bits, and
        //     67 (C) has code with length 3 bits
        for (let i = 0; i < addresses.length; i++) {
            headerData.push(addresses[i].char.charCodeAt()) // character
            headerData.push(addresses[i].address.length) // address
        };
        return headerData;
    }
}

class Stack {
    constructor() {
        this.stack = [];
        this.top = -1;
    }

    push(item) {this.stack[++this.top] = item;}
    pop() {return this.stack[this.top--];}
    peek() {return this.stack[this.top];}
    isEmpty() {return this.top === -1;}
}

class Queue {
    constructor(size) {
        this.maxSize = size;
        this.queue = new Array(this.maxSize);
        this.front = 0;
        this.rear = -1;
        this.n = 0;
    }

    insert(value) {
        this.queue[++this.rear] = value;
        this.n++;
    }

    remove() {
        let temp = this.queue[this.front++];
        if (this.front === this.maxSize) {
            this.front = 0;
        }
        this.n--;
        return temp;
    }

    peek() {return this.queue[this.front];}
    isEmpty() {return this.n === 0;}
    isFull() {return this.n === this.maxSize;}
    size() {return this.n;}
}

class Node {
    constructor(sum, leftChild, rightChild) {
        this.tree = "";
        if (arguments.length === 3) {
            this.sum = leftChild.sum + rightChild.sum;
            this.leftChild = leftChild;
            this.rightChild = rightChild;
        } else if (arguments.length === 2) {
            this.char = sum;
            this.sum = leftChild;
        } else {
            this.sum = 0;
        }
    }

    getChar() {return this.char;}
    setChar(char) {this.char = char;}
    getSum() {return this.sum;}
    setSum(sum) {this.sum = sum;}

    displayTree() {
        let root = this;
        if (root != null) {
            let charRep = `"${root.char}"`;
            if      (root.char === " ")  {charRep = `"[Space]"`}
            else if (root.char === "\n") {charRep = `"[Enter]"`}
            else if (root.char === "\t") {charRep = `"[Tab]"`}
            else if (root.char == null)  {charRep = "Node"}
            console.log(`(${charRep}, ${root.sum})`);
            this.tree += `(${charRep}, ${root.sum})` + '\n';

            this._displayTree(root.leftChild, "", true);
            this._displayTree(root.rightChild, "", false);
        }
    }

    _displayTree(root, prefix, isLeft) {
        if (root != null) {
            let charRep = `"${root.char}"`;
            if      (root.char === " ")  {charRep = `"[Space]"`}
            else if (root.char === "\n") {charRep = `"[Enter]"`}
            else if (root.char === "\t") {charRep = `"[Tab]"`}
            else if (root.char == null)  {charRep = "Node"}
            console.log(prefix + (isLeft ? "0 ├── " : "1 └── ") + `(${charRep}, ${root.sum})`);
            this.tree += prefix + (isLeft ? "0 ├── " : "1 └── ") + `(${charRep}, ${root.sum})` + '\n';

            this._displayTree(root.leftChild, prefix + (isLeft ? "  │   " : "      "), true);
            this._displayTree(root.rightChild, prefix + (isLeft ? "  │   " : "      "), false);
        }
    }
}

class Data {
    constructor(char, countOrAddress) {
        if (arguments.length === 2) {
            if (Array.isArray(countOrAddress)) {
                this.char = char;
                this.address = countOrAddress;
            } else {
                this.char = char;
                this.count = countOrAddress;
            }
        }
    }

    getChar() {return this.char;}
    getCount() {return this.count;}
    getAddress() {return this.address;}
    setAddress(address) {this.address = address;}
    toString() {return `${this.char}\t${this.count}`;}
}

class HashTable {
    constructor(size) {
        this.size = size;
        this.hashArray = new Array(size).fill(0);
        this.count = 0;
    }

    displayTable() {
        console.log("Table: ");
        for (let j = 0; j < this.size; j++) {
            if (this.hashArray[j] > 0) {
                console.log(`${String.fromCharCode(j)}\t${this.hashArray[j]}`);
            }
        }
        console.log("");
    }

    hashFunc(key) {return key % this.size;}

    add(char) {
        let key = char.charCodeAt(0);
        let hashVal = this.hashFunc(key);
        if (this.hashArray[hashVal] === 0) {
            this.count++;
        }
        this.hashArray[hashVal] += 1;
    }

    getTable() {
        let table = new Array(this.count);

        // For each data in the hash table...
        for (let i = 0; i < this.size; i++) {
            if (this.hashArray[i] > 0) {
                // Find the right index for hashArray[i]
                let j = 0;
                while (j < this.count && table[j] != null) { // Safeguard: stop if table[j] is null
                    if (this.hashArray[i] < table[j].count) {break;}
                    j++;
                }

                // Shift elements to the right to make space
                for (let k = this.count - 1; k > j; k--) {
                    table[k] = table[k - 1];
                }

                // Insert the new data
                table[j] = new Data(String.fromCharCode(i), this.hashArray[i]);
            }
        }

        return table;
    }
}

// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
function dropHandler(ev, mode) {
    console.log("File(s) dropped");
    ev.preventDefault();

    let files = [...ev.dataTransfer.files];
    
    if (!(files.length > 1)) {
        let file = files[0];
        let subtitle = document.querySelector('.subtitle');
        if (mode === 1) {
            if (file.name.endsWith('.txt')) {
                let originalFile = document.querySelector('.original-file a');
                originalFile.href = window.URL.createObjectURL(file);
                originalFile.download = `${file.name}`;
                file.text()
                    .then(async (value) => {
                        document.getElementById('main-info-wrapper').classList.remove('disable');
                        document.getElementById('wrapper-wrapper1').classList.remove('disable');
                        let titleInfo = document.querySelector('.title span');
                        let treeDisplay = document.querySelector('#tree pre');
                        let originalTableDiv = document.querySelector('#original-table > div');
                        let filenameDiv = document.getElementById('filename');
                        filenameDiv.innerText = file.name;
                        titleInfo.innerText = "encoding...";
                        
                        let output = await Huffman.encode(value);
                        
                        titleInfo.innerText = "done...";
                        let encodedString = output[0];
                        let addresses = output[1];
                        treeDisplay.innerText = output[2];
                        const table = generateTableFromText(output[3]);
                        originalTableDiv.appendChild(table);

                        let uint8 = new Uint8Array((encodedString.length % 8 == 0 ? encodedString.length / 8 : encodedString.length / 8 + 1) + addresses.length);
        
                        // store header
                        for (let i = 0; i < addresses.length; i++) {
                            uint8[i] = addresses[i];
                        }
        
                        // uint8[addresses.length] = encodedString.length % 8; // length of last byte is stored (actually we don't need to)
                        let j = addresses.length;
                        let blocks = []
                        for (let i = 0; i < encodedString.length; i += 8) {
                            const block = encodedString.slice(i, i + 8);
                            let byte = parseInt(block, 2);
                            uint8[j++] = byte;
                            
                            blocks.push(block);
                            // console.log(block);
                            // console.log(byte);
                        }
                        // console.log(uint8);
                        
                        // this is what in the final file later like this is the previouwiosdufhiodsuhfnkjo
                        blocks = [];
                        uint8.forEach((value) => {blocks.push(value.toString(2).padStart(8, '0'));})
                        console.log(blocks.join(' '));
        
                        let blob = new Blob([uint8], {type: "application/octet-stream"})
                        let encodedFile = document.querySelector('.encoded-file a');
                        encodedFile.href = window.URL.createObjectURL(blob);
                        encodedFile.download = `${file.name}.dzip`;
                        // encodedFile.click();
                    });
            } else {
                subtitle.innerText = "only .txt files please!";
                setTimeout(() => {
                    subtitle.innerText = "anywhere on the page";
                }, 2000);
            }
        } else {
            if (file.name.endsWith('.dzip')) {
                file.arrayBuffer()
                .then(async(value) => {
                    let titleInfo = document.querySelector('.title span');
                        titleInfo.innerText = "decoding...";
                        subtitle.innerText = "";

                        let decodedString = await Huffman.decode(value);

                        titleInfo.innerText = "done...";
                        subtitle.innerText = "";
                        let blob = new Blob([decodedString], { type: "text/plain" })
                        var a = document.createElement("a");
                        document.body.appendChild(a);
                        a.style = "display: none";
                        url = window.URL.createObjectURL(blob);
                        a.href = url;
                        a.download = `${file.name}`.replace('.dzip', '');
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    })
            } else {
                subtitle.innerText = "only .dzip files please!";
                setTimeout(() => {
                    subtitle.innerText = "anywhere on the page";
                }, 2000);
            }
        }
    }
}

function generateTableFromText(inputText) {
    // Ensure input text is valid
    if (!inputText || typeof inputText !== "string") {
        console.error("Invalid input text provided.");
        return null;
    }

    // Split the input text into lines and trim whitespace
    const lines = inputText.trim().split("\n");

    // Ensure there is at least one header line
    if (lines.length < 2) {
        console.error("Insufficient data to generate a table.");
        return null;
    }

    // Extract headers and data rows
    const headers = lines[0].split("\t");
    const rows = lines.slice(1).map(line => line.split("\t"));

    // Create a table element
    const table = document.createElement("table");
    table.classList.add("styled-table"); // Add a class for styling

    // Generate the header row
    const headerRow = document.createElement("tr");
    headers.forEach(header => {
        const th = document.createElement("th");
        th.textContent = header.trim();
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Generate the data rows
    rows.forEach(row => {
        const tableRow = document.createElement("tr");
        row.forEach(cell => {
            const td = document.createElement("td");
            td.textContent = cell.trim();
            tableRow.appendChild(td);
        });
        table.appendChild(tableRow);
    });

    return table;
}

// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
function dragOverHandler(ev) {
    console.log("File(s) in drop zone");
    ev.preventDefault();
    let titleInfo = document.querySelector('.title span');
    titleInfo.innerText = "drop the";
}

function dragLeaveHandler(ev) {
    console.log("File(s) in drop zone");
    ev.preventDefault();
    let titleInfo = document.querySelector('.title span');
    titleInfo.innerText = "drag over a";
}

document.addEventListener("DOMContentLoaded", (ev) => {
    document.body.addEventListener('dragover', (ev) => {dragOverHandler(ev);});
    document.body.addEventListener('dragleave', (ev) => {dragLeaveHandler(ev);});
    document.body.addEventListener('drop', (ev) => {
        ev.preventDefault();
        let selected = document.getElementsByClassName('nav-selected');
        dropHandler(ev, selected[0].id === 'nav-encode' ? 1 : 0);
    });

    const navEncode = document.getElementById('nav-encode');
    const navDecode = document.getElementById('nav-decode');

    navEncode.addEventListener('click', () => {
        navEncode.classList.add('nav-selected');
        navDecode.classList.remove('nav-selected');
        document.querySelector('.title span').innerText = "drag over a";
        document.querySelector('.title b').innerText = document.querySelector('.title b').innerText.replace('dzip', 'txt');
        document.querySelector('.subtitle').innerText = "anywhere on the page";
        document.getElementById('main-info-wrapper').classList.add('disable');
        document.getElementById('wrapper-wrapper1').classList.add('disable');
    });
    navDecode.addEventListener('click', () => {
        navDecode.classList.add('nav-selected');
        navEncode.classList.remove('nav-selected');
        document.querySelector('.title span').innerText = "drag over a";
        document.querySelector('.title b').innerText = document.querySelector('.title b').innerText.replace('txt', 'dzip');
        document.querySelector('.subtitle').innerText = "anywhere on the page";
        document.getElementById('main-info-wrapper').classList.add('disable');
        document.getElementById('wrapper-wrapper1').classList.add('disable');
    });
});
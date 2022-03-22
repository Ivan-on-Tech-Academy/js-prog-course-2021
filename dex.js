/* Moralis init code */
const serverUrl = "SERVER_URL_HERE";
const appId = "SERVER_APIKEY_HERE";
Moralis.start({ serverUrl, appId });

Moralis.initPlugins().then(console.log('Plugins have been initialized'))

const $tokenBalanceTBody = document.querySelector(".js-token-balances");
const $selectedToken = document.querySelector('.js-from-token');
const $amountInput = document.querySelector('.js-from-amount')

/* Authentication code */
async function login() {
    let user = Moralis.User.current();
    if (!user) {
        user = await Moralis.authenticate({ signingMessage: "Log in using Moralis" })
            .then(function(user) {
                console.log("logged in user:", user);
                console.log(user.get("ethAddress"));
            })
            .catch(function(error) {
                console.log(error);
            });
    }
    getStats()
}
/** Logout user */
async function logOut() {
    await Moralis.User.logOut();
    console.log("logged out");
}

document.querySelector("#btn-login").addEventListener('click', login)
document.querySelector("#btn-logout").addEventListener('click', logOut)


/* Initialize swap form */
async function initSwapForm(event) {
    event.preventDefault();
    $selectedToken.innerText = event.target.dataset.symbol;
    $selectedToken.dataset.address = event.target.dataset.address;
    $selectedToken.dataset.decimals = event.target.dataset.decimals;
    $selectedToken.dataset.max = event.target.dataset.max;
    $amountInput.removeAttribute('disabled');
    $amountInput.value = '';
    document.querySelector('.js-submit').removeAttribute('disabled');
    document.querySelector('.js-cancel').removeAttribute('disabled');
    document.querySelector('.js-quote-container').innerHTML = '';
    document.querySelector('.js-amount-error').innerText = ''

}

/* get all stats from user */
async function getStats() {

    const balances = await Moralis.Web3API.account.getTokenBalances({ chain: 'polygon' });
    console.log(balances)

    $tokenBalanceTBody.innerHTML = balances.map((token, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${token.symbol}</td>
            <td>${Moralis.Units.FromWei(token.balance, token.decimals)}</td>
            <td>
                <button
                    class="js-swap btn btn-success"
                    data-address="${token.token_address}"
                    data-symbol="${token.symbol}"
                    data-decimals="${token.decimals}"
                    data-max="${Moralis.Units.FromWei(token.balance, token.decimals)}"
                >
                Swap
                </button>
            </td>
        </tr>
    `).join('');

    for (let $btn of $tokenBalanceTBody.querySelectorAll('.js-swap')) {
        $btn.addEventListener('click', initSwapForm)
    }
}

/** fiat on ramp buy crypto */
async function buyCrypto() {
    Moralis.Plugins.fiat.buy()
}
document.getElementById("btn-buy-crypto").addEventListener('click', buyCrypto)

/** Quote / Swap  */
async function formSubmitted(event) {
    event.preventDefault()
    const fromAmount = Number.parseFloat($amountInput.value);
    const fromMaxValue = Number.parseFloat($selectedToken.dataset.max);
    if (Number.isNaN(fromAmount) || fromAmount > fromMaxValue) {
        //invalid input
        document.querySelector('.js-amount-error').innerText = 'Invalid Amount'
        return
    } else {
        document.querySelector('.js-amount-error').innerText = ''
    }
    // submission of the quote request
    const fromDecimals = $selectedToken.dataset.decimals;
    const fromTokenAddress = $selectedToken.dataset.address;

    const [toTokenAddress, toDecimals] = document.querySelector('[name=to-token]').value.split('-');

    try {
        const quote = await Moralis.Plugins.oneInch.quote({
            chain: 'polygon', // The blockchain you want to use (eth/bsc/polygon)
            fromTokenAddress, // The token you want to swap
            toTokenAddress, // The token you want to receive
            amount: Moralis.Units.Token(fromAmount, fromDecimals).toString(),
        });

        const toAmount = Moralis.Units.FromWei(quote.toTokenAmount, toDecimals)
        document.querySelector('.js-quote-container').innerHTML = `
        <p>
        ${fromAmount} ${quote.fromToken.symbol} = ${toAmount} ${quote.toToken.symbol}
        </p>
        <p> Gas fee: ${quote.estimatedGas} </p>
    `;
    } catch (e) {
        document.querySelector('.js-quote-container').innerHTML = `
            <p class="error">The conversion didn't succed.</p>
        `;
    }
}

async function formCanceled(event) {
    event.preventDefault()
    document.querySelector('.js-submit').setAttribute('disabled', '');
    document.querySelector('.js-cancel').setAttribute('disabled', '');
    $amountInput.value = '';
    $amountInput.setAttribute('disabled', '');
    delete $selectedToken.dataset.address;
    delete $selectedToken.dataset.decimals;
    delete $selectedToken.dataset.max;
    document.querySelector('.js-quote-container').innerHTML = '';
    document.querySelector('.js-amount-error').innerText = ''
}

document.querySelector('.js-submit').addEventListener('click', formSubmitted)
document.querySelector('.js-cancel').addEventListener('click', formCanceled)



/** to token dropdown preparation */
async function getTop10Tokens() {
    const response = await fetch('https://api.coinpaprika.com/v1/coins');
    const tokens = await response.json();

    return tokens
        .filter(token => token.rank >= 1 && token.rank <= 10)
        .map(token => token.symbol)
}
async function getTickerData(tickerList) {
    const tokens = await Moralis.Plugins.oneInch.getSupportedTokens({
        chain: 'polygon', // The blockchain you want to use (eth/bsc/polygon)
    });
    console.log(tokens)
    const tokenList = Object.values(tokens.tokens);

    return tokenList.filter(token => tickerList.includes(token.symbol))
}

function renderTokenDropDown(tokens) {
    const options = tokens.map(token => `
    <option value="${token.address}-${token.decimals}">
        ${token.name}
    </option>
    `).join('');
    document.querySelector('[name=to-token]').innerHTML = options;

}

/* Check if user is connected, IF true, execute stats */
function isUserConnected() {
    let user = Moralis.User.current();
    if (user) {
        getStats();
    }
}

isUserConnected()

getTop10Tokens()
    .then(getTickerData)
    .then(renderTokenDropDown)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IPancakeRouter {
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts);
    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function WETH() external pure returns (address);
}

contract TradingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant TREASURY_FEE_PERCENT = 50; // 50%
    uint256 public constant MAX_SLIPPAGE_PERCENT = 5; 
    uint256 public constant MIN_DEPOSIT = 0.01 ether; 
    uint256 public constant MAX_TRADE_SIZE = 10 ether; 
    uint256 public constant MAX_TRADE_SIZE_TOKENS = 5000 * 10**18; 

    IPancakeRouter public pancakeRouter;
    address public treasuryWallet;
    address public weth;

    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955; // Mainnet
    address public constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d; // Mainnet
    
    // Testnet addresses for development
    address public constant USDT_TESTNET = 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd;
    address public constant USDC_TESTNET = 0x64544969ED7eB0cC09976691157399E1aDC1a3CC;

    function getTokenAddress(address token) internal view returns (address) {
        // Allow both mainnet and testnet tokens
        if (token == USDT || token == USDT_TESTNET) return USDT;
        if (token == USDC || token == USDC_TESTNET) return USDC;
        revert("Unsupported token");
    }

    mapping(address => uint256) public userBalances;
    mapping(address => uint256) public userProfits;
    mapping(address => uint256) public userLastTradeTimestamp;

    struct Trade {
        address user;
        string pair;
        uint256 amountIn;
        uint256 amountOut;
        bool isBuy; 
        uint256 timestamp;
        uint256 feePaid;
        bool success;
    }

    Trade[] public trades;
    mapping(address => uint256[]) public userTradeIds;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event TradeExecuted(address indexed user, string pair, uint256 amountIn, uint256 amountOut, bool isBuy, uint256 fee, uint256 timestamp);
    event ProfitDistributed(address indexed user, uint256 userShare, uint256 treasuryShare);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor(address _router, address _treasury) {
        require(_router != address(0), "Invalid router");
        require(_treasury != address(0), "Invalid treasury");

        pancakeRouter = IPancakeRouter(_router);
        treasuryWallet = _treasury;
        weth = pancakeRouter.WETH();

        // REMOVED FOR TESTNET DEPLOYMENT TO PREVENT 0x REVERT
        // IERC20(USDT).safeApprove(_router, type(uint256).max);
        // IERC20(USDC).safeApprove(_router, type(uint256).max);
    }

    modifier onlyValidAmount(uint256 amount) {
        require(amount > 0, "Amount must be > 0");
        _;
    }

    modifier cooldownProtected(address user) {
        require(block.timestamp >= userLastTradeTimestamp[user] + 30 seconds, "Cooldown active");
        _;
    }

    function deposit() external payable nonReentrant onlyValidAmount(msg.value) {
        require(msg.value >= MIN_DEPOSIT, "Below minimum");
        userBalances[msg.sender] = userBalances[msg.sender].add(msg.value);
        userLastTradeTimestamp[msg.sender] = block.timestamp;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant onlyValidAmount(amount) {
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        require(address(this).balance >= amount, "Vault insufficient funds");

        userBalances[msg.sender] = userBalances[msg.sender].sub(amount);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawProfits(address token, uint256 amount) external nonReentrant onlyValidAmount(amount) {
        require(token == USDT || token == USDC, "Unsupported token");
        require(userProfits[msg.sender] >= amount, "Insufficient profit");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Vault insufficient tokens");

        userProfits[msg.sender] = userProfits[msg.sender].sub(amount);
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    function executeBuyTrade(string memory pair, address tokenOut, uint256 amountIn, uint256 minAmountOut) external nonReentrant cooldownProtected(msg.sender) onlyValidAmount(amountIn) {
        require(userBalances[msg.sender] >= amountIn, "Insufficient balance");
        require(amountIn <= MAX_TRADE_SIZE, "Exceeds limit");
        
        address resolvedToken = getTokenAddress(tokenOut);
        require(resolvedToken == USDT || resolvedToken == USDC, "Unsupported token");

        uint256 calculatedMinOut = _calculateMinAmountOut(amountIn, weth, resolvedToken);
        require(minAmountOut >= calculatedMinOut, "Slippage too high");

        userBalances[msg.sender] = userBalances[msg.sender].sub(amountIn);

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = resolvedToken;

        uint256[] memory amounts = pancakeRouter.swapExactETHForTokens{value: amountIn}(
            minAmountOut, path, address(this), block.timestamp + 20 minutes
        );

        uint256 amountOut = amounts[amounts.length - 1];
        uint256 fee = amountOut.mul(TREASURY_FEE_PERCENT).div(100);
        uint256 userShare = amountOut.sub(fee);

        userProfits[msg.sender] = userProfits[msg.sender].add(userShare);
        IERC20(resolvedToken).safeTransfer(treasuryWallet, fee);

        _recordTrade(msg.sender, pair, amountIn, amountOut, true, fee);
    }

    function executeSellTrade(string memory pair, address tokenIn, uint256 amountIn, uint256 minAmountOut) external nonReentrant cooldownProtected(msg.sender) onlyValidAmount(amountIn) {
        address resolvedToken = getTokenAddress(tokenIn);
        require(resolvedToken == USDT || resolvedToken == USDC, "Unsupported token");
        require(userProfits[msg.sender] >= amountIn, "Insufficient profit balance");
        require(amountIn <= MAX_TRADE_SIZE_TOKENS, "Exceeds limit");
        require(IERC20(resolvedToken).balanceOf(address(this)) >= amountIn, "Vault empty");

        uint256 calculatedMinOut = _calculateMinAmountOut(amountIn, resolvedToken, weth);
        require(minAmountOut >= calculatedMinOut, "Slippage too high");

        userProfits[msg.sender] = userProfits[msg.sender].sub(amountIn);

        address[] memory path = new address[](2);
        path[0] = resolvedToken;
        path[1] = weth;

        uint256[] memory amounts = pancakeRouter.swapExactTokensForETH(
            amountIn, minAmountOut, path, address(this), block.timestamp + 20 minutes
        );

        uint256 amountOut = amounts[amounts.length - 1];
        uint256 fee = amountOut.mul(TREASURY_FEE_PERCENT).div(100);
        uint256 userShare = amountOut.sub(fee);

        userBalances[msg.sender] = userBalances[msg.sender].add(userShare);
        (bool success, ) = payable(treasuryWallet).call{value: fee}("");
        require(success, "Fee failed");

        _recordTrade(msg.sender, pair, amountIn, amountOut, false, fee);
    }

    function _calculateMinAmountOut(uint256 amountIn, address tokenIn, address tokenOut) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        try pancakeRouter.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            uint256 expectedOut = amounts[amounts.length - 1];
            return expectedOut.mul(100 - MAX_SLIPPAGE_PERCENT).div(100);
        } catch {
            return amountIn.mul(95).div(100); 
        }
    }

    function _recordTrade(address user, string memory pair, uint256 amountIn, uint256 amountOut, bool isBuy, uint256 fee) internal {
        uint256 tradeId = trades.length;
        trades.push(Trade(user, pair, amountIn, amountOut, isBuy, block.timestamp, fee, true));
        userTradeIds[user].push(tradeId);
        userLastTradeTimestamp[user] = block.timestamp;
        
        emit TradeExecuted(user, pair, amountIn, amountOut, isBuy, fee, block.timestamp);
        emit ProfitDistributed(user, amountOut.sub(fee), fee);
    }

    function getUserInfo(address user) external view returns (uint256 balance, uint256 profit, uint256 lastTradeTime, uint256 tradeCount) {
        return (userBalances[user], userProfits[user], userLastTradeTimestamp[user], userTradeIds[user].length);
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = payable(owner()).call{value: amount}("");
            require(success, "BNB failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
        emit EmergencyWithdraw(owner(), amount);
    }

    receive() external payable {}
}
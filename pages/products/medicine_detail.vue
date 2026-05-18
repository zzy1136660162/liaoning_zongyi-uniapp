<template>
  <view class="page" :class="{ 'page-lock': showManual || showPolicy }">

    <view class="banner-wrapper">
      <swiper class="banner" :indicator-dots="true" :autoplay="productImages.length > 1" :interval="3000" indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#fff" @change="handleBannerChange">
        <swiper-item v-for="(img, idx) in productImages" :key="idx">
          <image class="banner-img" :src="img" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view class="banner-index">{{ currentIndex }}/{{ productImages.length }}</view>
    </view>
    <view class="split-line"></view>
    <view class="price-box">
      <view class="price-main">
        <view class="price-left">
          <view class="price-tag">闂備礁鎽滈崰搴∥涘Δ鍛鐟滃海绮嬮幒妤佺叆閻庯綆鍓欓ˉ?/view>
          <view class="price-info">
            <text class="price-unit">闂?/text>
            <text class="price-num">{{ priceInteger }}</text>
            <text class="price-decimal">.{{ priceDecimal }}</text>
          </view>
        </view>
        <view class="price-right">
          <view class="sales-box">
            <text class="sales-icon">婵☆偓绲介崯顖炲汲?/text>
            <text class="sales-count">闁诲海鎳撻幉陇銇愰崘顔兼瀬?{{ product.salesVolume || 0 }}</text>
          </view>
        </view>
      </view>
      <!-- <view class="trust-badges">
        <view class="trust-item"><image class="trust-icon" src="/static/logotou.png" mode="aspectFit" /><text class="trust-text">闂備礁鎲￠悧鏇⑩€﹀畡鎵虫瀺鐎光偓閸曨剙娈滃銈呯箰濞诧箓宕?/text></view>
        <view class="trust-item"><text class="trust-icon">婵☆偓绲介崯顖滅矆婢舵劖鐓?/text><text class="trust-text">婵犳鍠楃换鎰緤娴犲绠圭憸搴ｇ矚閸楃偐鏀藉┑鐘插椤?/text></view>
        <view class="trust-item"><text class="trust-icon">婵☆偓绲介崯顖滀焊?/text><text class="trust-text">闂佽崵濮甸崝锕傚储濞差亜绠梺顒€绉寸猾宥夋煟濡绲婚柟?/text></view>
        <view class="trust-item"><text class="trust-icon">婵☆偓绲介崯顖烆敊?/text><text class="trust-text">濠电偞鍨堕幐濠氬箰妞嬪海绠旈柣鏂垮悑閸嬪鏌嶉崫鍕偓濠氬Χ?/text></view>
        <view class="trust-item"><text class="trust-icon">闂?/text><text class="trust-text">24h闂備礁鎲￠悷锕傚垂婵傜绠?/text></view>
      </view> -->
    </view>

    <view class="goods-info">
      <view class="goods-name-row">
        <text class="self-developed-tag" v-if="product.bizType === 1">闂備胶鍘ч〃搴㈢閻愮儤鍋?/text>
        <text class="new-product-tag" v-if="product.isHospitalStarFormula === 1">闂傚倸鍊哥€氥劑宕归悡骞稑鐣濋崟顒€浠㈤柣搴秵閸撴瑩路閸岀偞鐓曢柟鐑樻礃绾儳顭?/text>
        <text class="star-product-tag" v-if="product.isNewProduct === 1">闂傚倷鐒﹁ぐ鍐矓閸泙澶嬬節閸パ勵棟闂佸搫顦扮€笛囧箚?/text>
        <text class="goods-name">{{ product.name }}&nbsp;{{ product.description }}</text>
      </view>
      <view class="goods-sub" v-if="product.subtitle || product.indications">{{ product.indications }}</view>
      <view class="drug-reminder">{{ product.isPrescription === 1 ? 'Prescription drug, use under medical guidance' : 'OTC drug, follow the instructions before use' }}</view>
    </view>

    <view class="policy-overlay" v-if="showPolicy" @click="closePolicyDrawer">
      <view class="policy-drawer" @click.stop>
        <view class="policy-header">
          <text class="policy-title">闂傚倷绶￠崑鈧柛瀣崌閺岀喖鐛崹顔句紘闂侀€涚串缁插潡骞忛悩纰樺亾濞戞鎴︼綖?/text>
          <view class="policy-close" @click="closePolicyDrawer">闂?/view>
        </view>
        <view class="policy-body">
          <view class="policy-section">
            <text class="policy-section-title"><text class="check-icon">闂?/text> 濠电偞鍨堕幐鍝ョ矓閻㈢鏋佹い鏇楀亾妤犵偞鍔栭幏鍛槹鎼搭喕绱濆┑鐘灩閻忓牓寮插鍏炬盯濡舵径瀣哗闂佺硶鍓濋悷锕傚汲閻樼粯鈷戞い鎰枎娴滈箖姊?/text>
            <text class="policy-content">闂備浇鍋愰悺鏃堝垂娴兼潙绠圭憸蹇旂閿曞倹鍊烽柟娈垮枦婢规﹢姊虹紒姗嗘畽妞ゎ偄顦甸幃楣冨煛閸涱厾鏌堥梺绯曞墲椤ㄥ棝骞嗛崒鐐寸叆婵炴垶顭囬悞鍛婄箾閸涱厽鎹ｉ柟宄扮秺婵℃悂鍩℃担璇′画闂傚倸鍊搁崑鍡涘闯閿濆鈧倿鎳為妷銉х獮闂佸搫绉堕弫鍝ョ矆婢跺ň妲堥柟缁㈠灠娴滃墽绱撻崒娆戭槮缂佺粯鍔欏顐︻敇閵忕姷顦╁┑鐐叉▕娴滄牠宕戦幘鎰佹僵妞ゆ帒鍊搁悡鎴炵箾閹寸偞灏紒澶屾暬瀵偊顢氶埀顒勭嵁閹邦厾鐟归柍褜鍓熼崺鈧い鎴ｆ娴滈箖姊虹涵鍜佸殐婵炵厧娼￠崺鈧?/text>
          </view>
          <view class="policy-section">
            <text class="policy-section-title"><text class="check-icon">闂?/text> 闂備礁鎽滈崕鎰板窗閺嶎厼绠栨俊銈勮兌閳瑰秵绻濋棃娑卞剱妞?/text>
            <text class="policy-content">濠电姷顣介埀顒€鍟块埀顒€鐏濋妴鎺楁嚋閻㈡娲搁梺绯曞墲椤曟挳骞掑Δ浣镐缓闂侀潧顭堥崝宀€绮婇埡鍛拻闁稿被鍊曞▍宥嗐亜閿濆嫮鐭欓柡浣哥Ф娴狅箓鎸婃径搴敼闂備浇澹堟ご绋款潖婵犳碍鐒鹃柟缁㈠枤瀹撲線鏌涢幇顓炵祷闂佷即浜堕弻銈囩驳鐎ｎ亞浠╃紓浣广仜閸嬫捇姊洪悷鎵憼闁绘娲滄禍鍛婂鐎涙ǚ鎸冮梺闈涚箞閸ㄨ櫣绮婇弻銉︾厱闊洦鎸鹃敍宥嗐亜椤愶絿澧遍柍褜鍓欑粻宥夊磹閺囥垹绠伴柍鍝勫暞鐎氭碍銇勯顐㈠幋闁?/text>
          </view>
        </view>
        <view class="policy-footer">
          <view class="policy-confirm-btn" @click="closePolicyDrawer">闂備胶鎳撻悺銊╁垂瑜版帗鍋傞柨鐔哄У閻掑ジ鏌熼幑鎰毢闁?/view>
        </view>
      </view>
    </view>

    <view class="select-section">
      <view class="select-label">闁诲海鎳撻幉锟犳偂閿熺姴鐒?/view>
      <view class="select-value">
        <text>{{ selectedSpec }}</text>
        <text class="select-num"> 闂佺厧顕、妾?quantity }}</text>
      </view>
    </view>

    <view class="drug-manual-card" @click="showManualDrawer">
      <view class="manual-item">
        <view class="manual-item-title">闂備浇鍋愰悺鏃堝垂閾忣偅娅犻悹鎭掑妿绾惧ジ鏌涢弴銊ュ闁?/view>
        <view class="manual-item-content">{{ product.ingredients || 'No information available' }}</view>
      </view>
      <view class="manual-divider"></view>
      <view class="manual-item">
        <view class="manual-item-title">闂備焦妞垮鍧楀礉瀹ュ洦鍏滈柛顐ｆ礃閸嬨劑鏌曟繛鐐珔婵?/view>
        <view class="manual-item-content">{{ product.usageDesc || 'No information available' }}</view>
      </view>
      <view class="manual-arrow">闂?/view>
    </view>

    <view class="policy-row" @click="showPolicyDrawer">
      <text class="policy-text">濠电偞鍨堕幐鍝ョ矓閻㈢鏋佹い鏇楀亾妤犵偞鍔栭幏鍛槹鎼搭喕绱濆┑鐘灩閻忓牓寮插鍏炬盯濡舵径瀣哗闂佺硶鍓濋悷锕傚汲閻樼粯鈷戞い鎰枎娴滈箖姊?闁?闂備礁鎽滈崕鎰板窗閺嶎厼绠栨俊銈呮噹鐎氬鈧箍鍎遍幊搴綖?/text>
      <text class="select-arrow">闂?/text>
    </view>
    <view class="delivery-row">
      <text class="delivery-label">闂傚倷鐒﹀妯肩矓瑜版帒鐒?/text>
      <image class="sf-logo" src="https://smf.lntcm.com/static/logo/sf.png" mode="aspectFit" />
      <text class="delivery-text">濠碉紕鍋戦崐娑橆浖閵娧勫皫闁圭虎鍠楅悡鈧悗骞垮劚椤︻偊宕戦幘瀵哥懝濠电姴瀚ˇ顕€姊洪崫鍕殺闁糕晜鐗犲鏌ュΨ閿旂虎娴勯梺闈涱槶閸庢娊寮舵禒瀣拻闁告洦鍋呴崳娲煛娴ｅ憡璐￠柟椋庮攰椤﹀弶绻濋埀顒勫箻椤斿ジ鏁滈梺閫炲苯澧紒瀣樀瀹曨偊宕熼锝囧讲</text>
    </view>

    <view class="promise-box">
      <view class="promise-item">
        <text class="promise-icon">闂?/text>
        <text class="promise-text">闂備礁鎲￠悧鏇⑩€﹀畡鎵虫瀺鐎光偓閸曨剙娈滃銈呯箰濡盯宕?/text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">闂?/text>
        <text class="promise-text">婵犳鍠楃换鎰緤娴犲绠圭憸搴ｇ矚閸楃偐鏀介悗锝庡亽閸?/text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">闂?/text>
        <text class="promise-text">濠电偞鍨堕幐濠氬箰妞嬪海绠旈柣鏂垮悑閸ゆ帗銇勯弽銊︾殤闁?/text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">闂?/text>
        <text class="promise-text">濠碉紕鍋戦崐娑橆浖閵娧勫皫闁圭虎鍠楅崑瀣煃閸濆嫬鈧濡?/text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">闂?/text>
        <text class="promise-text">闂傚倸鍊搁幊蹇涘礉濡ゅ拑缍栭柛鈩冾焽閳瑰秵绻濋棃娑欐悙鐞?/text>
      </view>
    </view>

    <view class="drawer-overlay" v-if="showManual" @click="closeManualDrawer">
      <view class="drawer-content drawer-green-card" @click.stop>
        <view class="drawer-header">
          <text class="drawer-title">闂備焦妞垮鍧楀礉韫囨挾鏆ら柛灞剧矋鐎氭岸鎮楀☉娅虫垿锝?/text>
          <view class="drawer-close" @click="closeManualDrawer">闂?/view>
        </view>
        <scroll-view class="drawer-body" scroll-y>
          <view class="drawer-section" v-if="product.ingredients">
            <text class="drawer-label">闂備線娼уΛ娆撳礉閺嶎厼鍨傛慨姗嗗幘椤╁嘲鈹戦钘夊闁?/text>
            <text class="drawer-text">{{ product.ingredients }}</text>
          </view>
          <view class="drawer-section" v-if="product.indications">
            <text class="drawer-label">闂備線娼уΛ娆撳礉閺囩喐鍙忔繛鎴欏灪閸ゅ嫰鏌熺€涙ê绗掗柣锔界矋缁绘稓浠﹂崜褎鑿囬梺?/text>
            <text class="drawer-text">{{ product.indications }}</text>
          </view>
          <view class="drawer-section" v-if="usageText">
            <text class="drawer-label">闂備線娼уΛ娆撳礉濡ゅ懎鏋侀柕鍫濇噳閺嬫牠鏌￠崶鈺佇ｉ柡鍡楃箻濮婃椽骞撻幒鏃傜杽闂?/text>
            <text class="drawer-text">{{ usageText }}</text>
          </view>
          <view class="drawer-section" v-if="product.adverseReactions">
            <text class="drawer-label">闂備線娼уΛ娆撳礉閹烘梻绠斿鑸靛姈閸ゅ本銇勯弽銊ㄥ闁告劏鍋撻梺鍦帶閻°劑寮婚敐澶婄劦?/text>
            <text class="drawer-text">{{ product.adverseReactions }}</text>
          </view>
          <view class="drawer-section" v-if="product.contraindication">
            <text class="drawer-label">闂備線娼уΛ娆撳礉濡ゅ懌鈧懘鏁冩担铏规澑闁诲繒鍋熼崕鐢稿磻?/text>
            <text class="drawer-text">{{ product.contraindication }}</text>
          </view>
          <view class="drawer-section" v-if="product.precautions">
            <text class="drawer-label">闂備線娼уΛ娆撳礉閺嶎厼鏋侀柣鎰惈缁犳盯鐓崶褎鎹ｉ柣銊﹀灥椤啴濡堕崨顖滄殯闂?/text>
            <text class="drawer-text">{{ product.precautions }}</text>
          </view>
          <view class="drawer-section" v-if="product.storageCondition">
            <text class="drawer-label">闂備線娼уΛ娆撳礉濡崵鈻旈柡灞诲劜鐎电娀鐓崶褜鍎岄柛?/text>
            <text class="drawer-text">{{ product.storageCondition }}</text>
          </view>
          <view class="drawer-section" v-if="product.manufacturer">
            <text class="drawer-label">闂備線娼уΛ娆撳礉濡ゅ懎鏋侀柟鎯ь嚟椤╄尙鎲稿鍛殾闁绘柨鎲℃刊瀵糕偓骞垮劚閸熺娀宕?/text>
            <text class="drawer-text">{{ product.manufacturer }}</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="split-line"></view>

    <view class="pharmacist-card">
      <view class="pharmacist-avatar-wrap">
        <image class="pharmacist-avatar" :src="pharmacistAvatar" mode="aspectFill" />
        <view class="online-tag">闂備線娼荤拹鐔煎礉鎼淬劌鍚?/view>
      </view>
      <view class="pharmacist-detail">
        <view class="pharmacist-name">闂備焦妞垮鍧楀礉韫囨挾鏆ら柛宀€鍋涘浠嬫煏婵犲海鍘涢柛?/view>
        <view class="pharmacist-desc">闂備礁鎼悧鍡浰囬棃娴虫盯鎳滅喊澶岀煑濠碘槅鍨伴幖顐ゆ媼閺屻儲鐓曟繝褍鐏濇慨鈧銈嗘礃椤ㄥ棛绮欐径鎰闁肩⒈鍓涢幊婵嬫⒑閼测晝鎽傞柛銊﹀缁參鍩€?/view>
      </view>
      <view class="consult-btn" @click.stop="goConsult">闂備礁鎲￠崵搴ㄥ礉韫囨侗鏁?/view>
    </view>
     <view class="split-line"></view>
    <view class="recommend-section" :class="{ 'combo-section': recommendTab === 'combo', 'star-section': recommendTab === 'star' }">
      <view class="recommend-tabs">
        <view class="recommend-tab" :class="{ active: recommendTab === 'combo' }" @click="switchRecommendTab('combo')">闂備焦妞垮鍧楀礉韫囨挾鏆ら柛灞剧矌绾惧ジ鏌涢弴銊ヤ簼闁?/view>
        <view class="recommend-tab" :class="{ active: recommendTab === 'star' }" @click="switchRecommendTab('star')">闂備礁鎼€氼剛鈧稈鏅涘嵄闁挎梻鏅々鑼喐瀹ュ绠?/view>
      </view>
      <view class="recommend-content">
        <scroll-view class="recommend-scroll" scroll-x v-if="recommendTab === 'combo' && comboProducts.length > 0">
          <view class="recommend-item" v-for="item in comboProducts" :key="item.id" @click="goToDetail(item)">
            <image class="recommend-img" :src="getImageUrl(item.image)" mode="aspectFit" />
            <view class="recommend-info">
              <text class="recommend-name">{{ item.name }}</text>
              <view class="recommend-bottom">
                <text class="recommend-price">闂備浇娉曢崳銉モ枔瀹?Number(item.price || 0).toFixed(2) }}</text>
                <view class="recommend-add-btn" :class="{ 'has-quantity': cartQuantities[item.id] > 0 }" @click.stop="flyToCart($event, item)">
                  <text v-if="cartQuantities[item.id]">{{ cartQuantities[item.id] }}</text>
                  <text v-else>+</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view v-else-if="recommendTab === 'combo'" class="empty-block">闂備礁鎼Λ妤呭磹閻熸嫈娑㈠Χ閸モ晝锛滈梺鍛婃处閸嬪懘宕愰妶澶嬬厵闁诡厽甯掓慨鈧悗?/view>
        <scroll-view class="recommend-scroll" scroll-x v-else-if="starProducts.length > 0">
          <view class="recommend-item" v-for="item in starProducts" :key="item.id" @click="goToDetail(item)">
            <image class="recommend-img" :src="getImageUrl(item.image)" mode="aspectFit" />
            <view class="recommend-info">
              <text class="recommend-name">{{ item.name }}</text>
              <view class="recommend-bottom">
                <text class="recommend-price">闂備浇娉曢崳銉モ枔瀹?Number(item.price || 0).toFixed(2) }}</text>
                <view class="recommend-add-btn" :class="{ 'has-quantity': cartQuantities[item.id] > 0 }" @click.stop="flyToCart($event, item)">
                  <text v-if="cartQuantities[item.id]">{{ cartQuantities[item.id] }}</text>
                  <text v-else>+</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view v-else class="empty-block">闂備礁鎼Λ妤呭磹閻熸嫈娑㈠Χ婢跺﹤寮烽柟鍏肩暘閸ㄩ缚顤傚┑鐐茬摠缁倿宕橀埡鍌氬壃</view>
      </view>
      <view class="combo-disclaimer" v-if="recommendTab === 'combo'">*闂備焦妞垮鍧楀礉韫囨挾鏆ら柛灞剧矌绾惧ジ鏌涢弴銊ヤ簼闁稿鍊曢湁闁绘ê寮堕崳鍝ョ磼閸撲焦鏆€规洩缍佸畷鎺戔攽閸愩劋澹曢梺鍛婂姌濞夋洜绮堟径鎰厸闁割偅鑹炬禍鍓х磽閸屾瑧顦﹂柣妤€鎳忕粋宥夊箳濡も偓缁€宀勬偣閸パ冪骇濡ゆ梹绻涢幋鐐村碍闁圭⒈鍋婂畷?/view>

      <view class="flying-dot" v-if="flyingDot.show" :style="{ left: flyingDot.x + 'px', top: flyingDot.y + 'px' }"></view>
    </view>

    <view class="split-line"></view>

    <view class="detail-header">
      <view class="detail-tab" :class="{ active: detailTab === 'desc' }" @click="switchDetailTab('desc')">闂佽崵濮村ù鍕⒔閸曨垰纾?/view>
      <view class="detail-tab" :class="{ active: detailTab === 'review' }" @click="switchDetailTab('review')">闂佽崵濮村ú銈団偓姘间邯閹?/view>
    </view>

    <view class="detail-body" v-if="detailTab === 'desc'">
      <view class="detail-title">{{ product.detailTitle || 'Product details' }}</view>
      <rich-text v-if="product.intro" class="detail-richtext" :nodes="formatRichText(product.intro)"></rich-text>
      <view v-else class="empty-block">闂備礁鎼Λ妤呭磹閻熸嫈娑㈠Χ婢跺﹦鍊為梺缁樺姦閸撴岸鎮楅鈧幃褰掑炊閻戣姤顎嶉梺?/view>
      <view class="detail-images" v-if="showDetailImages">
        <image v-for="(img, idx) in productImages" :key="idx" :src="img" mode="widthFix" class="detail-img" />
      </view>

      <!-- <view class="spec-list">
        <view class="spec-title">闂備浇鍋愰悺鏃堝垂娴兼潙绠圭憸鏂跨暦濞差亝鍊绘俊顖滅帛鐎氳櫕绻涢敐鍛闁告挻绻冪€?/view>
        <view class="spec-item" v-for="item in specItems" :key="item.label">
          <text class="spec-label">{{ item.label }}</text>
          <text class="spec-value">{{ item.value }}</text>
        </view>
      </view> -->

      <view class="usage-box" v-if="specItems.length > 0">
        <view class="usage-title">闂備浇鍋愰悺鏃堝垂娴兼潙绠圭憸鏂跨暦濞差亝鍊绘俊顖滅帛鐎氳櫕绻涢敐鍛闁告挻绻冪€?/view>
        <view class="usage-list">
          <view class="usage-item" v-for="item in specItems" :key="item.label">
            <text class="usage-label">{{ item.label }}</text>
            <text class="usage-text">{{ item.value }}</text>
          </view>
        </view>
      </view>

      <view class="usage-box" v-if="usageItems.length > 0">
        <view class="usage-title">闂備焦妞垮鍧楀礉韫囨挾鏆ら柛灞剧矋鐎氭岸鎮楀☉娅虫垿锝?/view>
        <view class="usage-list">
          <view class="usage-item" v-for="item in usageItems" :key="item.label">
            <text class="usage-label">{{ item.label }}</text>
            <text class="usage-text">{{ item.value }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="detail-body" v-if="detailTab === 'review'">
      <view class="empty-block">闂備礁鎼Λ妤呭磹閻熸嫈娑㈠Χ閸ャ劌鐝伴梺鍛婃处娴滅偤鐛?/view>
    </view>

    <view class="reminder-bar">
      <text class="reminder-icon">!</text>
      <text class="reminder-text">闂佽崵濮村ú鈺併€掗崷顓炲灊闁冲搫鍟扮壕濂告煕閳╁啰鈯曟い顐㈩樀閹綊宕堕妸锔绘健閻庤鎸搁崐鍨暦椤愶絾濯寸紒娑橆儏濞堫垶姊洪崫鍕仼缂併劌銈稿畷婵嬫偄閻撳海顓洪梺鍝勮癁閸曨喖鎯堥梻浣告啞閻楃偤顢氳缁參鍩€椤掑嫭鐓忛柛鈩冩礃缁佹壆鈧鎸搁崐濠氬极椤曗偓瀹曞ジ鎮㈡搴⑩枌闂佽娴烽弫璇参涚捄銊х當闁告侗鍠楁刊鎾偣閹帒濡介柡鍡楃箻閺屾洟宕卞Δ鈧埀顒冩閻ｇ敻宕掗悙韫炊婵炶揪绲块…鍫ユ儊閸洘鍋″ù锝呮啞閸ｅ湱鈧鍣ｉˉ鎾诲箯閻樼鍋撳☉娅虫垿锝為弽顓熷仯闁搞儺浜濋懙鐟懊瑰鍕闁逞屽墮濠€閬嶅磻閵堝拋鐎舵い鏍仜缂佲晠鎮归崫鍕儓闁绘挸鍊块弻锝夊Ω閵夈儺浠奸梺鍝勬噷閸ㄨ棄鐣烽锝嗗闁汇値鍨抽ˇ浼存⒑閸涘﹤鐏ユ俊顐㈤叄閸┾偓?/text>
    </view>

    <view class="customer-service-float" @click="showCustomerService">闂佽楠哥粻宥夊垂閸濆嫸鑰?/view>

    <view class="bottom-space"></view>

    <view class="bottom-bar">
      <view class="bottom-left">
        <view class="action-icon-btn" @click="toggleCollect">
          <text class="action-icon">{{ isCollected ? '闂? : '闂? }}</text>
          <text class="action-text">{{ isCollected ? 'Saved' : 'Favorite' }}</text>
        </view>
        <view class="action-icon-btn" @click="goCart">
          <text class="action-icon">婵☆偓绲介崯顖滃?/text>
          <text class="action-text">闂佽崵濮甸崝锕傚储閻愵剚娅犻柟绋垮婵?/text>
          <view class="cart-badge" v-if="cartCount > 0">{{ cartCount > 99 ? '99+' : cartCount }}</view>
        </view>
      </view>
      <view class="bottom-right">
        <view class="btn-add-cart" @click="addCart">闂備礁鎲″缁樻叏閹绢喖鐭楅柛鈩冪懄鐎氱粯銇勯幘璺盒㈤柍閿嬬墵瀵?/view>
        <view class="btn-buy" @click="buyNow">缂傚倷鐒﹂弻銊╊敄閸涱厾鏆ら柛鈩冪懄鐎氱粯銇勯幘瀵哥畺閻?/view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { STORAGE_KEY_CURRENT_CONSULTATION_ID } from '@/utils/storage.js'
import { getProductDetail, mapProductDetail } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import {
  addCartItem,
  getCartProductInfo,
  getCartProductQuantity,
  getCartTotalQuantity,
  prepareCheckout,
  resolveCartCompatibility
} from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'
import { BIZ_TYPE_HEALTH_GOODS, hasBoundQuestionnaire } from '@/utils/product-biz.js'
import { getToken } from '@/utils/request.js'

const createEmptyProduct = () => ({
  id: '',
  name: '',
  subtitle: '',
  description: '',
  price: 0,
  image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
  images: [],
  intro: '',
  unit: '',
  salesVolume: 0,
  bizType: 1,
  goodsMerchantType: 1,
  isPrescription: 0,
  needQuestionnaire: 0,
  questionnaireId: null,
  isHospitalStarFormula: 0,
  isNewProduct: 0,
  detailTitle: '',
  isStarProduct: 0,
  indications: '',
  ingredients: '',
  commonUsage: '',
  usageDesc: '',
  contraindication: '',
  precautions: '',
  storageCondition: '',
  adverseReactions: '',
  appearanceDesc: '',
  dosageForm: '',
  packageSpec: '',
  specText: '',
  validityPeriod: '',
  originType: 0,
  approvalNumber: '',
  manufacturer: '',
  executionStandard: '',
  warmTips: '',
  relatedProducts: [],
  starProducts: []
})

const product = ref(createEmptyProduct())
const quantity = ref(1)
const showManual = ref(false)
const showPolicy = ref(false)
const detailTab = ref('desc')
const currentIndex = ref(1)
const cartCount = ref(0)
const isCollected = ref(false)
const flyingDot = ref({ show: false, x: 0, y: 0 })
const recommendTab = ref('combo')
const cartQuantities = ref({})
const comboProducts = ref([])
const starProducts = ref([])

const productImages = computed(() => {
  if (product.value.images && product.value.images.length > 0) {
    return product.value.images
  }
  return product.value.image ? [product.value.image] : [getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')]
})

const showDetailImages = computed(() => !product.value.intro && productImages.value.length > 0)
const usageText = computed(() => product.value.commonUsage || product.value.usageDesc || '')
const requiresQuestionnaire = computed(() => hasBoundQuestionnaire(product.value))
const selectedSpec = computed(() => product.value.specText || product.value.packageSpec || product.value.unit || 'Not specified')
const priceInteger = computed(() => {
  const [integer = '0'] = Number(product.value.price || 0).toFixed(2).split('.')
  return integer
})
const priceDecimal = computed(() => {
  const [, decimal = '00'] = Number(product.value.price || 0).toFixed(2).split('.')
  return decimal
})
const originTypeText = computed(() => {
  if (product.value.originType === 1) return 'In-house'
  if (product.value.originType === 2) return 'Purchased'
  return ''
})

const specItems = computed(() => {
  return [
    { label: 'Product', value: product.value.name },
    { label: 'Spec', value: product.value.specText },
    { label: 'Package', value: product.value.packageSpec },
    { label: 'Dosage form', value: product.value.dosageForm },
    { label: 'Appearance', value: product.value.appearanceDesc },
    { label: 'Validity', value: product.value.validityPeriod },
    { label: 'Origin type', value: originTypeText.value },
    { label: 'Approval No.', value: product.value.approvalNumber },
    { label: 'Manufacturer', value: product.value.manufacturer },
    { label: 'Standard', value: product.value.executionStandard },
    { label: 'Tips', value: product.value.warmTips }
  ].filter(item => item.value)
})

const usageItems = computed(() => {
  return [
    { label: 'Ingredients', value: product.value.ingredients },
    { label: 'Indications', value: product.value.indications },
    { label: 'Usage', value: usageText.value },
    { label: 'Adverse reactions', value: product.value.adverseReactions },
    { label: 'Contraindications', value: product.value.contraindication },
    { label: 'Precautions', value: product.value.precautions },
    { label: 'Storage', value: product.value.storageCondition }
  ].filter(item => item.value)
})

const loadCartCount = () => {
  cartCount.value = getCartTotalQuantity()
}

const resolveRecommendTab = () => {
  if (comboProducts.value.length > 0) {
    return 'combo'
  }
  if (starProducts.value.length > 0) {
    return 'star'
  }
  return 'combo'
}

const loadQuantityFromStorage = () => {
  if (!product.value.id) {
    quantity.value = 1
    return
  }
  quantity.value = getCartProductQuantity(product.value.id, 1)
}

const loadRecommendCartQuantities = () => {
  const nextQuantities = {}
  ;[...comboProducts.value, ...starProducts.value].forEach((item) => {
    const currentQuantity = getCartProductQuantity(item.id, 0)
    if (currentQuantity > 0) {
      nextQuantities[item.id] = currentQuantity
    }
  })
  cartQuantities.value = nextQuantities
}

const applyProduct = (source) => {
  const mapped = mapProductDetail(source)
  product.value = {
    ...createEmptyProduct(),
    ...mapped
  }
  currentIndex.value = 1
  comboProducts.value = Array.isArray(mapped.relatedProducts) ? mapped.relatedProducts : []
  starProducts.value = Array.isArray(mapped.starProducts) ? mapped.starProducts : []
  recommendTab.value = resolveRecommendTab()
  loadQuantityFromStorage()
  loadRecommendCartQuantities()
}

const loadProduct = async (id) => {
  try {
    uni.showLoading({ title: '闂備礁鎲″缁樻叏閹灐褰掑炊閵娧€鏋?..' })
    const response = await getProductDetail(id)
    applyProduct(response)
  } catch (error) {
    console.error('loadProduct failed:', error)
    uni.showToast({
      title: error.message || 'Failed to load product',
      icon: 'none'
    })
  } finally {
    uni.hideLoading()
  }
}

const formatRichText = (htmlContent) => {
  if (!htmlContent) return ''
  const normalizeRichText = (content) => content
    .replace(/<img([^>]*)style=(['"])(.*?)\2([^>]*)>/gi, (match, before, quote, styleContent, after) => {
      const sanitizedStyle = styleContent
        .replace(/(?:^|;)\s*width\s*:[^;]*/gi, '')
        .replace(/(?:^|;)\s*height\s*:[^;]*/gi, '')
        .trim()
      const nextStyle = `max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;${sanitizedStyle ? ` ${sanitizedStyle}` : ''}`.trim()
      return `<img${before}style="${nextStyle}"${after}>`
    })
    .replace(/<img((?:(?!style=)[^>])*)>/gi, '<img$1 style="max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;">')

  if (typeof htmlContent === 'string') {
    return normalizeRichText(
      htmlContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    )
  }
  return normalizeRichText(String(htmlContent))
}

const buildDetailRedirect = () => {
  return product.value.id ? `/pages/products/medicine_detail?id=${product.value.id}` : '/pages/products/medicine_detail'
}

const ensureLogin = () => {
  if (getToken()) {
    return true
  }
  uni.navigateTo({
    url: `/pages/register/register?redirect=${encodeURIComponent(buildDetailRedirect())}`
  })
  return false
}

const ensureCartCompatible = (targetProduct) => {
  const result = resolveCartCompatibility(targetProduct, {
    ignoreProductId: targetProduct?.id
  })
  if (!result.valid) {
    uni.showToast({
      title: result.message,
      icon: 'none'
    })
    return false
  }
  return true
}

const hasQuestionnairePassed = (productId) => {
  const entry = getCartProductInfo(productId)
  return !!(entry && entry.questionnairePassed)
}

const navigateToNotice = (targetProduct, selectedQuantity, action = 'cart') => {
  uni.navigateTo({
    url: `/pages/products/product_notice?id=${targetProduct.id}&quantity=${selectedQuantity}&action=${action}`
  })
  return false
}

const goCheckout = (targetProduct) => {
  const checkout = prepareCheckout([String(targetProduct.id)], [{
    id: 'detail_checkout',
    products: [targetProduct]
  }])

  if (!checkout.valid) {
    uni.showToast({
      title: checkout.message,
      icon: 'none'
    })
    return false
  }

  const selectedItems = checkout.productIds.join(',')
  if (Number(targetProduct.bizType) === BIZ_TYPE_HEALTH_GOODS) {
    uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
    uni.navigateTo({
      url: `/pages/order/confirm?selectedItems=${selectedItems}`
    })
    return true
  }

  uni.navigateTo({
    url: `/pages/dispense/apply?selectedItems=${selectedItems}`
  })
  return true
}

const handlePurchaseAction = async (mode, targetProduct = product.value, selectedQuantity = 1) => {
  if (!targetProduct?.id) {
    return false
  }

  if (!ensureLogin()) {
    return false
  }

  if (!ensureCartCompatible(targetProduct)) {
    return false
  }

  const nextQuantity = Math.max(1, Number(selectedQuantity) || 1)
  const alreadyPassed = hasQuestionnairePassed(targetProduct.id)
  if (hasBoundQuestionnaire(targetProduct) && !alreadyPassed) {
    return navigateToNotice(targetProduct, nextQuantity, mode)
  }

  const saved = addCartItem(targetProduct, nextQuantity, {
    questionnairePassed: !hasBoundQuestionnaire(targetProduct) || alreadyPassed
  })
  if (!saved) {
    uni.showToast({
      title: 'Failed to add to cart',
      icon: 'none'
    })
    return false
  }

  loadCartCount()
  loadRecommendCartQuantities()
  if (String(targetProduct.id) === String(product.value.id)) {
    loadQuantityFromStorage()
  }

  if (mode === 'buy') {
    return goCheckout(targetProduct)
  }

  uni.showToast({
    title: 'Added to cart',
    icon: 'success'
  })
  return true
}

const addCart = async () => {
  await handlePurchaseAction('cart', product.value, quantity.value)
}

const buyNow = async () => {
  await handlePurchaseAction('buy', product.value, quantity.value)
}

const handleBannerChange = (event) => {
  currentIndex.value = event.detail.current + 1
}

const showManualDrawer = () => {
  showManual.value = true
}
const closeManualDrawer = () => {
  showManual.value = false
}
const showPolicyDrawer = () => {
  showPolicy.value = true
}
const closePolicyDrawer = () => {
  showPolicy.value = false
}
const switchDetailTab = (tab) => {
  detailTab.value = tab
}
const switchRecommendTab = (tab) => {
  recommendTab.value = tab
}
const goBack = () => {
  uni.navigateBack()
}
const handleMore = () => {
  uni.showActionSheet({
    itemList: ['Back to list', 'View cart'],
    success: ({ tapIndex }) => {
      if (tapIndex === 0) {
        uni.navigateTo({ url: '/pages/products/medicine_list' })
      } else if (tapIndex === 1) {
        goCart()
      }
    }
  })
}
const goConsult = () => {
  uni.showToast({
    title: 'Online consultation is coming soon',
    icon: 'none'
  })
}
const showCustomerService = () => {
  uni.showModal({
    title: 'Contact service',
    content: '82961387',
    confirmText: 'OK',
    success: ({ confirm }) => {
      if (!confirm) {
        return
      }
      uni.makePhoneCall({
        phoneNumber: '82961387',
        fail: () => {
          uni.showToast({
            title: 'Unable to place the call',
            icon: 'none'
          })
        }
      })
    }
  })
}
const toggleCollect = () => {
  isCollected.value = !isCollected.value
}
const goCart = () => {
  uni.navigateTo({
    url: '/pages/cart/cart'
  })
}

const goToDetail = (item) => {
  if (!item?.id || String(item.id) === String(product.value.id)) return
  uni.navigateTo({
    url: `/pages/products/medicine_detail?id=${item.id}&product=${encodeURIComponent(JSON.stringify(item))}`
  })
}

const animateFlyToCart = () => {
  try {
    const query = uni.createSelectorQuery().in(getCurrentInstance())
    query.select('.action-icon-btn').boundingClientRect((target) => {
      query.select('.recommend-add-btn').boundingClientRect((source) => {
        if (target && source) {
          flyingDot.value.show = true
          flyingDot.value.x = source.left + 10
          flyingDot.value.y = source.top + 10

          setTimeout(() => {
            flyingDot.value.x = 50
            flyingDot.value.y = window.screen.height - 200
            setTimeout(() => {
              flyingDot.value.show = false
            }, 400)
          }, 50)
        }
      }).exec()
    }).exec()
  } catch (error) {
    console.log('animateFlyToCart error:', error)
  }
}

const flyToCart = async (event, item) => {
  const nextQuantity = getCartProductQuantity(item.id, 0) + 1
  const added = await handlePurchaseAction('cart', item, nextQuantity)
  if (added) {
    animateFlyToCart()
  }
}

onLoad((options) => {
  logPageView('MEDICINE_DETAIL', options?.id || '')
  product.value = createEmptyProduct()

  if (options.id) {
    loadProduct(options.id)
  } else if (options.product) {
    try {
      const parsed = JSON.parse(decodeURIComponent(options.product))
      applyProduct(parsed)
      if (parsed.id) {
        loadProduct(parsed.id)
      }
    } catch (error) {
      console.error('parse product failed:', error)
    }
  }

  loadCartCount()
})

onShow(() => {
  loadCartCount()
  loadQuantityFromStorage()
  loadRecommendCartQuantities()
})
</script>

<style lang="scss" scoped>
.page {
  background: #fff;
  min-height: 100vh;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
  z-index: -1;
}

.page-lock {
  overflow: hidden;
  height: 100vh;
  touch-action: none;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  z-index: 100;
  border-bottom: 1rpx solid #eee;
}

.header-left, .header-right {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-back {
  font-size: 48rpx;
  color: #333;
  font-weight: bold;
}

.icon-more {
  font-size: 36rpx;
  color: #333;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.banner-wrapper {
  position: relative;
  background: #fff;
}

.banner {
  height: 750rpx;
}

.banner-img {
  width: 100%;
  height: 100%;
}

.banner-index {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
}

.price-box {
  margin-bottom: 18rpx;
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10rpx,
      rgba(255, 255, 255, 0.03) 10rpx,
      rgba(255, 255, 255, 0.03) 20rpx
    ),
    linear-gradient(90deg, #f05a5a, #ff6b6b);
  padding: 20rpx 30rpx 16rpx;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  border-radius: 36rpx 36rpx 0 0;
}

.price-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price-left {
  display: flex;
  flex-direction: column;
}

.price-tag {
  display: inline-block;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  margin-bottom: 8rpx;
  width: fit-content;
  font-weight: bold;
}

.price-info {
  display: flex;
  align-items: baseline;
  color: #fff;
}

.price-unit {
  font-size: 22rpx;
  font-weight: bold;
  color: #fff;
}

.price-num {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}

.price-decimal {
  font-size: 26rpx;
  font-weight: bold;
  color: #fff;
}

.price-right {
  display: flex;
  align-items: center;
}

.sales-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.sales-icon {
  font-size: 24rpx;
  margin-bottom: 4rpx;
}

.sales-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
}

.trust-badges {
  display: flex;
  justify-content: flex-start;
  gap: 20rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx dashed rgba(255, 255, 255, 0.3);
  flex-wrap: wrap;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.trust-icon {
  font-size: 22rpx;
  width: 28rpx;
  height: 28rpx;
  vertical-align: middle;
}

.trust-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.95);
}

.goods-info {
  background: #fff;
  padding: 0 30rpx 2rpx;
}

.goods-name-row {
  display: inline;
  vertical-align: middle;
}

.self-developed-tag,
.new-product-tag,
.star-product-tag,
.goods-name {
  vertical-align: middle;
}

.self-developed-tag,
.new-product-tag,
.star-product-tag {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  font-weight: bold;
  flex-shrink: 0;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
  display: inline;
}

.self-developed-tag {
  background: #ff4b4b;
  color: #fff;
}

.new-product-tag {
  background: #4a4a4a;
  color: #d4af37;
}

.star-product-tag {
  background: #00c792;
  color: #fff;
}

.goods-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #222;
  line-height: 1.4;
  word-break: break-all;
}

.goods-sub {
  font-size: 26rpx;
  color: #888;
  margin-top: 8rpx;
}

.drug-reminder {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.policy-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 30rpx;
}

.policy-row .policy-text {
  flex: 1;
}

.policy-text {
  font-size: 24rpx;
  color: #666;
}

.policy-overlay,
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
}

.policy-drawer,
.drawer-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 85vh;
  height: auto;
}

.policy-header,
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  position: relative;
}

.policy-title,
.drawer-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.policy-close,
.drawer-close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 48rpx;
  color: #999;
}

.policy-body,
.drawer-body {
  width: 690rpx;
  padding: 30rpx;
  max-height: calc(85vh - 120rpx);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.drawer-body::-webkit-scrollbar {
  display: none;
}


.policy-section {
  margin-bottom: 30rpx;
}

.policy-section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}

.check-icon {
  color: #ff4b4b;
  margin-right: 8rpx;
}

.policy-content {
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
}

.policy-footer {
  padding: 20rpx 30rpx 40rpx;
}

.policy-confirm-btn {
  background: linear-gradient(135deg, #ffd000, #ffb800);
  color: #333;
  font-size: 32rpx;
  font-weight: bold;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 44rpx;
}

.select-section {
  background: #fff;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
}

.select-label {
  font-size: 28rpx;
  color: #999;
  margin-right: 20rpx;
}

.select-value {
  flex: 1;
  font-size: 28rpx;
  color: #222;
}

.select-num {
  color: #ff4b4b;
}

.select-arrow {
  font-size: 36rpx;
  color: #999;
}

.promise-box {
  background: #fff;
  padding: 20rpx 30rpx;
  display: flex;
  flex-wrap: wrap;
}

.promise-item {
  display: flex;
  align-items: center;
  margin-right: 30rpx;
  margin-bottom: 12rpx;
}

.promise-icon {
  font-size: 22rpx;
  color: #00c792;
  margin-right: 6rpx;
}

.promise-text {
  font-size: 22rpx;
  color: #666;
}

.delivery-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 5rpx 30rpx 30rpx;
}

.delivery-label {
  font-size: 26rpx;
  color: #222;
  margin-right: 16rpx;
}

.delivery-text {
  font-size: 26rpx;
  color: #222;
}

.sf-logo {
  width: 34rpx;
  height: 30rpx;
  margin-right: 12rpx;
}

.drug-manual-card {
  background: #f5f5f5;
  border-radius: 16rpx;
  margin: 20rpx 30rpx;
  padding: 24rpx;
  display: flex;
  align-items: flex-start;
  position: relative;
}

.manual-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.manual-item-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.manual-item-content {
  font-size: 24rpx;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.manual-divider {
  width: 1rpx;
  height: 60rpx;
  background: #ddd;
  margin: 0 24rpx;
}

.manual-arrow {
  font-size: 36rpx;
  color: #999;
  position: absolute;
  right: 24rpx;
}

.drawer-section {
  margin-bottom: 30rpx;
}

.drawer-label {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  display: block;
  margin-bottom: 12rpx;
}

.drawer-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.8;
}

.split-line {
  height: 20rpx;
  background: #f4f4f4;
}

.recommend-section {
  padding: 30rpx 0;
  width: 100%;
}

.recommend-section.combo-section {
  background: linear-gradient(180deg, #c8e6c9, #fff);
}

.recommend-section.star-section {
  background: linear-gradient(180deg, #ffecb3, #fff);
}

.recommend-tabs {
  display: flex;
  justify-content: flex-start;
  gap: 60rpx;
  padding-left: 30rpx;
  margin-bottom: 24rpx;
}

.recommend-tab {
  font-size: 28rpx;
  color: #333;
  padding-bottom: 8rpx;
  position: relative;
}

.recommend-tab.active {
  color: #e63939;
  font-weight: bold;
}

.recommend-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 50rpx;
  height: 4rpx;
  background: #e63939;
  border-radius: 2rpx;
}

.combo-disclaimer {
  font-size: 22rpx;
  color: #999;
  padding: 0 30rpx 16rpx;
  letter-spacing: 1rpx;
}

.recommend-content {
  padding: 20rpx 30rpx;
  border-radius: 16rpx;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}

.recommend-scroll {
  white-space: nowrap;
  width: 100%;
}

.recommend-item {
  display: inline-block;
  width: 200rpx;
  margin-right: 20rpx;
  vertical-align: top;
}

.recommend-img {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}

.recommend-info {
  padding: 12rpx 0;
}

.recommend-name {
  display: block;
  font-size: 24rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.recommend-price {
  font-size: 26rpx;
  color: #e63939;
  font-weight: bold;
}

.recommend-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recommend-add-btn {
  width: 40rpx;
  height: 40rpx;
  background: linear-gradient(135deg, #e63939, #ff4b4b);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
  line-height: 1;
}

.recommend-add-btn.has-quantity {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  font-size: 22rpx;
}

.flying-dot {
  position: fixed;
  width: 20rpx;
  height: 20rpx;
  background: #e63939;
  border-radius: 50%;
  z-index: 9999;
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.pharmacist-card {
  background: linear-gradient(135deg, #f0fdf9, #e6f7f1);
  padding: 28rpx 30rpx;
  display: flex;
  align-items: center;
  border-radius: 20rpx;
  margin: 20rpx 24rpx;
  border: 1rpx solid #d4f0e6;
  box-shadow: 0 4rpx 20rpx rgba(0, 199, 146, 0.08);
}

.pharmacist-avatar-wrap {
  position: relative;
  margin-right: 24rpx;
}

.pharmacist-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 4rpx solid #00c792;
  padding: 4rpx;
  background: #fff;
}

.online-tag {
  position: absolute;
  bottom: 0;
  right: 0;
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  font-weight: bold;
  border: 2rpx solid #fff;
}

.pharmacist-detail {
  flex: 1;
}

.pharmacist-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #1a1a1a;
  display: flex;
  align-items: center;
}

.pharmacist-name::before {
  content: '*';
  margin-right: 8rpx;
  font-size: 28rpx;
}

.pharmacist-desc {
  font-size: 24rpx;
  color: #666;
  margin-top: 6rpx;
}

.consult-btn {
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  padding: 14rpx 36rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 16rpx rgba(0, 199, 146, 0.3);
}

.detail-header {
  background: #fff;
  display: flex;
  border-bottom: 1rpx solid #eee;
}

.detail-tab {
  flex: 1;
  text-align: center;
  padding: 28rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.detail-tab.active {
  color: #ff4b4b;
  font-weight: bold;
}

.detail-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #ff4b4b;
  border-radius: 2rpx;
}

.detail-body {
  background: #fff;
  padding: 30rpx;
}

.detail-title,
.usage-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 24rpx;
}

.detail-richtext {
  font-size: 28rpx;
  color: #555;
  line-height: 1.8;
  width: 100%;
  overflow: hidden;
  word-break: break-word;
}

.detail-images {
  margin-top: 30rpx;
}

.detail-img {
  width: 100%;
  display: block;
  margin-bottom: 20rpx;
}

.spec-list,
.usage-list {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 24rpx;
}

.spec-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  padding: 20rpx 0 16rpx;
  border-bottom: 2rpx solid #eee;
  margin-bottom: 8rpx;
}

.spec-item {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eee;
}

.spec-item:last-child {
  border-bottom: none;
}

.spec-label {
  width: 160rpx;
  font-size: 26rpx;
  color: #999;
}

.spec-value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.usage-box {
  margin-top: 30rpx;
}

.usage-item {
  margin-bottom: 20rpx;
}

.usage-item:last-child {
  margin-bottom: 0;
}

.usage-label {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}

.usage-text {
  font-size: 26rpx;
  color: #333;
  line-height: 1.6;
}

.empty-block {
  font-size: 28rpx;
  color: #999;
  text-align: center;
  padding: 40rpx 0;
}

.reminder-bar {
  background: #fffbe6;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
  margin: 20rpx 0;
}

.reminder-icon {
  width: 32rpx;
  height: 32rpx;
  background: #faad14;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  margin-right: 12rpx;
}

.reminder-text {
  font-size: 24rpx;
  color: #ad6800;
  flex: 1;
  line-height: 1.6;
}

.customer-service-float {
  position: fixed;
  right: 24rpx;
  bottom: 150rpx;
  z-index: 120;
  min-width: 88rpx;
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 44rpx;
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 32rpx rgba(0, 167, 118, 0.24);
}

.bottom-space {
  height: 40rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1rpx solid #eee;
  z-index: 100;
}

.bottom-left {
  display: flex;
}

.action-icon-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 40rpx;
}

.action-icon {
  font-size: 40rpx;
}

.action-text {
  font-size: 20rpx;
  color: #666;
  margin-top: 4rpx;
}

.cart-badge {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  min-width: 32rpx;
  height: 32rpx;
  background: #ff4b4b;
  color: #fff;
  border-radius: 16rpx;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
}

.bottom-right {
  display: flex;
  margin-left: auto;
}

.btn-add-cart, .btn-buy {
  padding: 20rpx 36rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.btn-add-cart {
  background: #ffa940;
  color: #fff;
  margin-right: 16rpx;
}

.btn-buy {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  color: #fff;
}
</style>

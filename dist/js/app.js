var $menus = $('#menus')
var $banners = $('#banners')
var $download = $('#download')
var $about = $('#about')
var $window = $(window)
var $menuBanners = $('.menu-banners')
var $menuDownload = $('.menu-download')
var $menuAbout = $('menu-about')
var menusHeight = $('#menus').height()
var mainHeaderHeight = $('.main-header').height()

$menus.on('click', '.btn', function (e) {
  var $this = $(this)
  var $targetElem = $('#' + $this.data('target'))
  // if (!$this.hasClass('active')) {
  //   $menus.find('.active').removeClass('active')
  //   $this.addClass('active')
  // }
  if ($menus.hasClass('fixed')) {
    $('html, body').animate({
      scrollTop: $targetElem.position().top - menusHeight + 'px'
    }, 300, function () {
      // animation complete
    })
  } else {
    $('html, body').animate({
      scrollTop: $targetElem.position().top - mainHeaderHeight + 'px'
    }, 300, function () {
      // animation complete
    })
  }
})

$window.scroll(function () {
  var scrollTop = $window.scrollTop()
  var menusTop = $menus.position().top
  var scrollTimer = null
  if (scrollTop > menusTop) {
    $('.main-header').addClass('hide')
    $banners.css({ 'padding-top': '56px' })
    $menus.addClass('fixed')
  } else if (scrollTop === 0 && $menus.hasClass('fixed')) {
    $('.main-header').removeClass('hide')
    $banners.css({ 'padding-top': '0' })
    $menus.removeClass('fixed')
  }
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }
  scrollTimer = setTimeout(function () {
    var paddingTop = scrollTop + menusHeight
    if (paddingTop < $download.position().top && !$menuBanners.hasClass('active')) {
      $menus.find('.active').removeClass('active')
      $menuBanners.addClass('active')
    } else if (
      paddingTop >= $download.position().top &&
      paddingTop < $about.position().top &&
      !$menuDownload.hasClass('active')
    ) {
      $menus.find('.active').removeClass('active')
      $menuDownload.addClass('active')
    } else if (
      paddingTop >= $about.position().top &&
      !$menuAbout.hasClass('active')
    ) {
      $menus.find('.active').removeClass('active')
      $menuAbout.addClass('active')
    }
  }, 50)
})

setTimeout(function () {
  window.scroll(0, 0)
}, 0)

function initSliders () {
  var numOfBanners = $banners.find('.banner').length
  var $bannersWrapper = $banners.find('.banners')
  var bannerWidth = $banners.width()
  var intervalTimer = null
  var sliderIndex = 0
  $banners.find('.banners').css({
    width: numOfBanners * 100 + '%'
  })
  $banners.find('.banner').css({
    width: bannerWidth + 'px'
  })
  $banners.find('.dots').html((function () {
    var html = ''
    for (var i = 0; i < numOfBanners; i++) {
      if (i === sliderIndex) {
        html += '<span data-index="' + i + '" class="dot active"></span>'
      } else {
        html += '<span data-index="' + i + '" class="dot"></span>'
      }
    }
    return html
  })())

  function showSlider (sliderIdx) {
    sliderIdx = parseInt(sliderIdx)
    $banners.find('.dot').removeClass('active').eq(sliderIdx).addClass('active')
    $bannersWrapper.css({
      transform: 'translate(-' + bannerWidth * sliderIdx + 'px, 0)'
    })
  }
  $banners.on('click', '.dot', function (e) {
    var $this = $(this)
    showSlider($this.data('index'))
  })
  intervalTimer = setInterval(function () {
    sliderIndex++
    if (sliderIndex >= numOfBanners) {
      sliderIndex = 0
    }
    showSlider(sliderIndex)
  }, 2000)
}
initSliders()

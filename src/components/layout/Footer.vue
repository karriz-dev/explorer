/*
 *
 * Copyright (c) 2019-present for NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License ");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

<template>
	<div class="page-footer">
		<footer class="footer">
			<div class="width-limiter">
				<b-container fluid>
					<b-row class="footer-row mx-0 mx-md-4 mx-lg-4 px-lg-4">
						<b-col sm="12" lg="4" offset-lg="4" class="vertical-center">
							<ul class="social-icon">
								<li
									v-for="item in footerItems"
									:key="item.text"
									class="social-icon-item"
								>
									<a target="_blank" :href="item.href">
										<component :is="item.icon" />
										<span>{{item.text}}</span>
									</a>
								</li>
							</ul>
						</b-col>
						<b-col lg="4" class="vertical-center">
							<NodeSelector class="horisontal-center"/>
						</b-col>
					</b-row>
					<SymbolCopyRight />
				</b-container>
			</div>
		</footer>
	</div>
</template>

<script>
import SymbolCopyRight from '@/components/SymbolCopyRight.vue';
import NodeSelector from '@/components/controls/NodeSelector.vue';

import IconGithub from 'vue-material-design-icons/GithubCircle.vue';
import IconNewspaper from 'vue-material-design-icons/Newspaper.vue';
import IconDiscord from 'vue-material-design-icons/Discord.vue';
import IconTwitter from 'vue-material-design-icons/Twitter.vue';
import IconHomeCurrencyUsd from 'vue-material-design-icons/HomeCurrencyUsd.vue';
import globalConfig from '../../config/globalConfig';

export default {
	components: {
		SymbolCopyRight,
		NodeSelector,

		IconGithub,
		IconNewspaper,
		IconDiscord,
		IconHomeCurrencyUsd,
		IconTwitter
	},

	computed: {
		footerItems() {
			if (this.$store.getters['api/isTestnet'])
				return globalConfig.footer.link;

			return globalConfig.footer.link.filter(item => item.text !== 'Faucet');
		}
	}
};
</script>

<style lang="scss" scoped>
.page-footer {
    width: 100%;
}

.footer {
    padding: 50px 0 0;
    width: 100%;
    position: relative;

    .footer-row {
        .footer-description {
            margin-top: -40px;
        }
    }
}

.footer::before {
    content: '';
    background-image: var(--footer-bg-img);
    position: absolute;
    z-index: 0;
    bottom: 0;
    right: 0;
    width: 100%;
    height: 100%;
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
}

.social-icon {
    list-style: none;
    justify-content: center;
    flex-wrap: wrap;
    display: flex;
    padding: 0;
    margin: 0 -15px;

    .social-icon-item {
        margin: 5px 10px;
        text-transform: uppercase;

        a {
            color: var(--clickable-text);
            text-decoration: none;

            span {
                margin-left: 5px;
            }

            i {
                font-size: 15px;
            }
        }
    }
}

.vertical-center {
    margin-top: 5px;
    display: flex;
    justify-content: center;
}

.horisontal-center {
    display: block;
    margin-left: auto;
    margin-right: auto;
}

.width-limiter {
    display: block;
    width: 100%;
    max-width: $footer-max-width;
    margin-left: auto;
    margin-right: auto;
}

@media (max-width: 764px) {
    .social-icon {
        justify-content: center;
    }
}
</style>
